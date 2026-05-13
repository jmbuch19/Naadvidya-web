import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Teacher generates recurring scheduled_sessions for an active Gurukul enrolment.
// Skips the teacher's marked holidays. Reserves 1 credit per generated session from
// the student's balance (NAADVIDYA_CLASS_DESIGN.md: "term credits reserved").
//
// Body: { enrollmentId, daysOfWeek: number[] (0=Sun..6=Sat), time: 'HH:MM' (IST),
//         startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', durationMinutes?: 60 }

interface Body {
  enrollmentId: string;
  daysOfWeek: number[];
  time: string;
  startDate: string;
  endDate: string;
  durationMinutes?: number;
}

interface EnrollmentRow {
  id: string; status: string; student_id: string; teacher_id: string;
  credits_reserved: number; sessions_total: number | null;
  teacher: { profile_id: string };
  offering: { offering_type: string; title: string };
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const MAX_SESSIONS = 200;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.enrollmentId || !Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0 || !HHMM.test(body.time ?? '') || !body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'enrollmentId, daysOfWeek, time (HH:MM), startDate, endDate are all required' }, { status: 400 });
  }
  const duration = [15, 30, 45, 60, 90].includes(body.durationMinutes ?? 60) ? (body.durationMinutes ?? 60) : 60;

  const { data: enr } = await supabase
    .from('enrollments')
    .select('id, status, student_id, teacher_id, credits_reserved, sessions_total, teacher:teacher_profiles!enrollments_teacher_id_fkey(profile_id), offering:class_offerings!enrollments_offering_id_fkey(offering_type, title)')
    .eq('id', body.enrollmentId)
    .maybeSingle<EnrollmentRow>();
  if (!enr) return NextResponse.json({ error: 'Enrolment not found' }, { status: 404 });
  if (enr.teacher.profile_id !== user.id) return NextResponse.json({ error: 'Not your enrolment' }, { status: 403 });
  if (enr.status !== 'active') return NextResponse.json({ error: `Enrolment is ${enr.status} — accept it first.` }, { status: 400 });

  // Build the candidate datetimes.
  const [h, m] = body.time.split(':').map(Number);
  const days = new Set(body.daysOfWeek.map((d) => Math.max(0, Math.min(6, Math.floor(d)))));
  const start = new Date(`${body.startDate}T00:00:00`);
  const end = new Date(`${body.endDate}T23:59:59`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return NextResponse.json({ error: 'Invalid start/end date.' }, { status: 400 });
  }

  // Teacher's marked holidays in the window.
  const admin = createServiceRoleClient();
  const { data: holidays } = await admin
    .from('teacher_holidays')
    .select('holiday_date')
    .eq('teacher_id', enr.teacher_id)
    .eq('affects_students', true)
    .gte('holiday_date', body.startDate)
    .lte('holiday_date', body.endDate)
    .returns<{ holiday_date: string }[]>();
  const holidaySet = new Set((holidays ?? []).map((r) => r.holiday_date));

  // Existing session datetimes for this enrolment (avoid duplicates if re-run).
  const { data: existingSessions } = await admin
    .from('scheduled_sessions').select('scheduled_at').eq('enrollment_id', enr.id).returns<{ scheduled_at: string }[]>();
  const existingSet = new Set((existingSessions ?? []).map((r) => new Date(r.scheduled_at).toISOString()));

  const candidates: string[] = [];
  const skippedHoliday: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && candidates.length < MAX_SESSIONS && guard < 6000) {
    guard++;
    if (days.has(cursor.getDay())) {
      const ymd = cursor.toISOString().slice(0, 10);
      if (holidaySet.has(ymd)) {
        skippedHoliday.push(ymd);
      } else {
        const dt = new Date(cursor);
        dt.setHours(h ?? 19, m ?? 0, 0, 0);
        const iso = dt.toISOString();
        if (dt.getTime() > Date.now() && !existingSet.has(iso)) candidates.push(iso);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No sessions to create — check the dates and recurring days.' }, { status: 400 });
  }

  // Reserve credits = number of sessions to create.
  const { data: credits } = await admin
    .from('student_credits').select('credits_balance').eq('student_id', enr.student_id).maybeSingle<{ credits_balance: number }>();
  if (!credits || credits.credits_balance < candidates.length) {
    return NextResponse.json({
      error: `The student needs ${candidates.length} credits for this schedule (they have ${credits?.credits_balance ?? 0}). Ask them to top up, or shorten the term.`,
    }, { status: 402 });
  }

  const { error: rpcErr } = await admin.rpc('apply_credit_change', {
    p_student_id: enr.student_id, p_type: 'debit', p_credits: candidates.length,
    p_note: `Reserved for Gurukul Path "${enr.offering.title}" (${candidates.length} sessions)`,
  });
  if (rpcErr) return NextResponse.json({ error: `Credit reservation failed: ${rpcErr.message}` }, { status: 500 });

  // Determine starting session_number (continue from existing).
  const baseNum = existingSessions?.length ?? 0;
  const rows = candidates.map((iso, i) => ({
    enrollment_id: enr.id,
    teacher_id: enr.teacher_id,
    student_id: enr.student_id,
    scheduled_at: iso,
    duration_minutes: duration,
    session_number: baseNum + i + 1,
    status: 'upcoming' as const,
  }));
  const { error: insErr } = await admin.from('scheduled_sessions').insert(rows);
  if (insErr) {
    await admin.rpc('apply_credit_change', { p_student_id: enr.student_id, p_type: 'refund', p_credits: candidates.length, p_note: 'Rollback — bulk schedule failed' });
    return NextResponse.json({ error: `Scheduling failed: ${insErr.message}` }, { status: 500 });
  }

  // Update the enrolment totals.
  const lastIso = candidates[candidates.length - 1];
  await admin
    .from('enrollments')
    .update({
      sessions_total: (enr.sessions_total ?? 0) + candidates.length,
      credits_reserved: enr.credits_reserved + candidates.length,
      end_date: new Date(lastIso).toISOString().slice(0, 10),
    })
    .eq('id', enr.id);

  return NextResponse.json({ created: candidates.length, skippedHolidays: skippedHoliday });
}
