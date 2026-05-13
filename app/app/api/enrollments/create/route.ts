import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Student enrols in a class offering.
//   riyaaz_workshop  → must not have started; seats available; student has >= N credits;
//                      deduct N credits; enrollment status 'active'; create N scheduled_sessions.
//   gurukul_path     → application: enrollment status 'pending' + intent_text; no credits yet
//                      (those are reserved when the teacher sets up the schedule). Teacher accepts/declines.
//   mehfil_session   → treated like a small workshop if it has a session_schedule; otherwise
//                      students should book via the normal Mehfil flow — we just reject here.

interface Body { offeringId: string; intentText?: string }

interface OfferingRow {
  id: string;
  teacher_id: string;
  offering_type: 'gurukul_path' | 'riyaaz_workshop' | 'mehfil_session';
  title: string;
  total_sessions: number | null;
  max_students: number;
  session_schedule: string[] | null;
  is_visible: boolean;
  is_active: boolean;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Only students enrol.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (profile?.role && profile.role !== 'student') {
    return NextResponse.json({ error: 'Only students can enrol.' }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.offeringId) return NextResponse.json({ error: 'offeringId required' }, { status: 400 });

  const { data: offering } = await supabase
    .from('class_offerings')
    .select('id, teacher_id, offering_type, title, total_sessions, max_students, session_schedule, is_visible, is_active')
    .eq('id', body.offeringId)
    .maybeSingle<OfferingRow>();
  if (!offering || !offering.is_visible || !offering.is_active) {
    return NextResponse.json({ error: 'Offering not available' }, { status: 404 });
  }

  // Already enrolled / applied?
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('offering_id', offering.id)
    .eq('student_id', user.id)
    .in('status', ['pending', 'active', 'paused'])
    .maybeSingle<{ id: string; status: string }>();
  if (existing) {
    return NextResponse.json({ error: `You already have a ${existing.status === 'pending' ? 'pending application' : 'an active enrolment'} for this.` }, { status: 409 });
  }

  // --- Gurukul Path: application ---
  if (offering.offering_type === 'gurukul_path') {
    const intent = (body.intentText ?? '').trim();
    if (intent.length < 20) {
      return NextResponse.json({ error: 'Please write a short note (≥20 characters) about your background and what you hope to learn.' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        offering_id: offering.id,
        student_id: user.id,
        teacher_id: offering.teacher_id,
        status: 'pending',
        intent_text: intent,
        credits_reserved: 0,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Application failed' }, { status: 500 });
    return NextResponse.json({ id: data.id, status: 'pending' });
  }

  // --- Workshop (or Mehfil series with a fixed schedule) ---
  const schedule = Array.isArray(offering.session_schedule) ? offering.session_schedule : [];
  if (offering.offering_type === 'mehfil_session' && schedule.length === 0) {
    return NextResponse.json({ error: 'This Mehfil offering is booked one session at a time — open the teacher’s profile to book.' }, { status: 400 });
  }
  const n = offering.total_sessions ?? schedule.length;
  if (n < 1 || schedule.length < n) {
    return NextResponse.json({ error: 'This offering has no published session schedule yet.' }, { status: 400 });
  }

  // No late entry once it has started.
  const first = new Date(schedule[0]);
  if (first.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This workshop has already started — no late entry.' }, { status: 409 });
  }

  // Seats available?
  const { count: enrolled } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('offering_id', offering.id)
    .in('status', ['active', 'paused']);
  if ((enrolled ?? 0) >= offering.max_students) {
    return NextResponse.json({ error: 'This workshop is full.' }, { status: 409 });
  }

  // Enough credits?
  const { data: credits } = await supabase
    .from('student_credits').select('credits_balance').eq('student_id', user.id).maybeSingle<{ credits_balance: number }>();
  if (!credits || credits.credits_balance < n) {
    return NextResponse.json({ error: `You need ${n} credits to enrol (you have ${credits?.credits_balance ?? 0}).` }, { status: 402 });
  }

  // Create the enrolment (RLS: student inserts own).
  const lastDate = new Date(schedule[Math.min(n, schedule.length) - 1]);
  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollments')
    .insert({
      offering_id: offering.id,
      student_id: user.id,
      teacher_id: offering.teacher_id,
      status: 'active',
      start_date: first.toISOString().slice(0, 10),
      end_date: lastDate.toISOString().slice(0, 10),
      sessions_total: n,
      sessions_completed: 0,
      credits_reserved: n,
    })
    .select('id')
    .single<{ id: string }>();
  if (enrErr || !enrollment) return NextResponse.json({ error: enrErr?.message ?? 'Enrolment failed' }, { status: 500 });

  const admin = createServiceRoleClient();

  // Deduct N credits atomically.
  const { error: rpcErr } = await admin.rpc('apply_credit_change', {
    p_student_id: user.id,
    p_type: 'debit',
    p_credits: n,
    p_note: `Enrolled in workshop "${offering.title}" (${n} sessions)`,
  });
  if (rpcErr) {
    await admin.from('enrollments').delete().eq('id', enrollment.id);
    return NextResponse.json({ error: `Credit reservation failed: ${rpcErr.message}` }, { status: 500 });
  }

  // Bulk-create the scheduled sessions (no Daily rooms yet — created on first join).
  const rows = schedule.slice(0, n).map((iso, i) => ({
    enrollment_id: enrollment.id,
    teacher_id: offering.teacher_id,
    student_id: user.id,
    scheduled_at: iso,
    duration_minutes: 60,
    session_number: i + 1,
    status: 'upcoming' as const,
  }));
  const { error: sessErr } = await admin.from('scheduled_sessions').insert(rows);
  if (sessErr) {
    // Roll back credits + enrolment.
    await admin.rpc('apply_credit_change', { p_student_id: user.id, p_type: 'refund', p_credits: n, p_note: `Rollback — workshop enrolment failed` });
    await admin.from('enrollments').delete().eq('id', enrollment.id);
    return NextResponse.json({ error: `Scheduling failed: ${sessErr.message}` }, { status: 500 });
  }

  console.log(`[enrollments] workshop enrolment ${enrollment.id} — ${n} sessions, ${n} credits reserved`);
  return NextResponse.json({ id: enrollment.id, status: 'active', sessions: n });
}
