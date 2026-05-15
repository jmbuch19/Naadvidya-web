import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyHolidayCancellation } from '@/lib/notifications';

// POST: add a holiday (YYYY-MM-DD). Side effect: cancel any confirmed bookings
// or upcoming scheduled_sessions for this teacher on that date, refund credits,
// and notify each affected student (SCHEDULING_HOLIDAY_POLICY §4.3).
// DELETE: remove a holiday (no side effects — sessions stay cancelled, must be
// re-booked).

const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface AffectedBooking {
  id: string;
  scheduled_at: string;
  student_id: string;
  is_trial: boolean;
  credits_deducted: number;
  student: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean };
}

interface AffectedSession {
  id: string;
  scheduled_at: string;
  student_id: string;
  student: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, profile:profiles!teacher_profiles_profile_id_fkey(full_name)')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string; profile: { full_name: string } }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  let body: { date?: string; reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.date || !YMD.test(body.date)) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 });

  const { error } = await supabase
    .from('teacher_holidays')
    .upsert(
      { teacher_id: teacher.id, holiday_date: body.date, reason: body.reason?.trim() || null, affects_students: true },
      { onConflict: 'teacher_id,holiday_date' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Find affected confirmed sessions in IST day window. `holiday_date` is a calendar
  // date in the teacher's local zone (effectively Asia/Kolkata for Phase 1.5 — full
  // timezone handling is a Phase 2 concern). We cover 00:00 → 23:59:59 IST on that
  // date by converting to UTC: IST is UTC+5:30, so the IST day starts at 18:30 the
  // previous UTC day.
  const dayStartUtc = new Date(`${body.date}T00:00:00+05:30`).toISOString();
  const dayEndUtc = new Date(`${body.date}T23:59:59+05:30`).toISOString();

  const admin = createServiceRoleClient();
  const cancelledNow = new Date().toISOString();
  const reasonLabel = 'Teacher holiday';

  const [{ data: bookings }, { data: sessions }] = await Promise.all([
    admin
      .from('bookings')
      .select(`
        id, scheduled_at, student_id, is_trial, credits_deducted,
        student:profiles!bookings_student_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in)
      `)
      .eq('teacher_id', teacher.id)
      .eq('status', 'confirmed')
      .gte('scheduled_at', dayStartUtc)
      .lte('scheduled_at', dayEndUtc)
      .returns<AffectedBooking[]>(),
    admin
      .from('scheduled_sessions')
      .select(`
        id, scheduled_at, student_id,
        student:profiles!scheduled_sessions_student_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in)
      `)
      .eq('teacher_id', teacher.id)
      .eq('status', 'upcoming')
      .gte('scheduled_at', dayStartUtc)
      .lte('scheduled_at', dayEndUtc)
      .returns<AffectedSession[]>(),
  ]);

  let cancelledBookings = 0;
  let cancelledSessions = 0;

  for (const b of bookings ?? []) {
    if (!b.is_trial && b.credits_deducted > 0) {
      await admin.rpc('apply_credit_change', {
        p_student_id: b.student_id,
        p_type: 'refund',
        p_credits: b.credits_deducted,
        p_booking_id: b.id,
        p_note: `Cancelled — ${reasonLabel} on ${body.date}`,
      });
    }
    const { error: cancelErr } = await admin
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_reason: `${reasonLabel} (${body.date})`,
        cancelled_by: user.id,
        cancelled_at: cancelledNow,
      })
      .eq('id', b.id);
    if (cancelErr) continue;
    cancelledBookings++;

    try {
      await notifyHolidayCancellation({
        student: {
          email: b.student.email,
          fullName: b.student.full_name,
          whatsappNumber: b.student.whatsapp_number,
          whatsappOptedIn: b.student.whatsapp_opted_in,
        },
        teacherName: teacher.profile.full_name,
        scheduledAt: new Date(b.scheduled_at),
        holidayDate: body.date,
      });
    } catch (e) { console.error('[holidays] notify failed:', e); }
  }

  for (const s of sessions ?? []) {
    // Scheduled sessions reserve 1 credit per session at enrollment time.
    await admin.rpc('apply_credit_change', {
      p_student_id: s.student_id,
      p_type: 'refund',
      p_credits: 1,
      p_note: `Cancelled scheduled session — ${reasonLabel} on ${body.date}`,
    });

    const { error: cancelErr } = await admin
      .from('scheduled_sessions')
      .update({ status: 'cancelled' })
      .eq('id', s.id);
    if (cancelErr) continue;
    cancelledSessions++;

    try {
      await notifyHolidayCancellation({
        student: {
          email: s.student.email,
          fullName: s.student.full_name,
          whatsappNumber: s.student.whatsapp_number,
          whatsappOptedIn: s.student.whatsapp_opted_in,
        },
        teacherName: teacher.profile.full_name,
        scheduledAt: new Date(s.scheduled_at),
        holidayDate: body.date,
      });
    } catch (e) { console.error('[holidays] notify failed:', e); }
  }

  return NextResponse.json({
    ok: true,
    cancelled_bookings: cancelledBookings,
    cancelled_sessions: cancelledSessions,
  });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  const date = new URL(req.url).searchParams.get('date');
  if (!date || !YMD.test(date)) return NextResponse.json({ error: 'date query param required' }, { status: 400 });

  const { error } = await supabase.from('teacher_holidays').delete().eq('teacher_id', teacher.id).eq('holiday_date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
