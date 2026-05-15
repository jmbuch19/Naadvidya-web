import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validatePropose, withinMonthlyLimit } from '@/lib/reschedule';
import { notifyReschedulProposed } from '@/lib/notifications';

// POST = propose a reschedule. Caller can be student or teacher of the booking.
// Body: { new_scheduled_at: ISO string, reason: string }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.naadvidya.com';

interface BookingDetail {
  id: string;
  status: string;
  scheduled_at: string | null;
  reschedule_count: number;
  reschedule_proposed_at: string | null;
  student_id: string;
  student: { full_name: string; email: string };
  teacher: {
    id: string;
    profile_id: string;
    profile: { full_name: string; email: string };
  };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { new_scheduled_at?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const newAtRaw = body.new_scheduled_at;
  const reason = (body.reason ?? '').trim();
  if (!newAtRaw || reason.length < 5) {
    return NextResponse.json({ error: 'new_scheduled_at and a reason (min 5 chars) are required' }, { status: 400 });
  }
  const proposedNewAt = new Date(newAtRaw);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, reschedule_count, reschedule_proposed_at, student_id,
      student:profiles!bookings_student_id_fkey(full_name, email),
      teacher:teacher_profiles!bookings_teacher_id_fkey(
        id, profile_id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)
      )
    `)
    .eq('id', params.id)
    .maybeSingle<BookingDetail>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const isStudent = booking.student_id === user.id;
  const isTeacher = booking.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `Cannot reschedule a ${booking.status} booking.` }, { status: 400 });
  }
  if (!booking.scheduled_at) {
    return NextResponse.json({ error: 'Booking has no scheduled time yet.' }, { status: 400 });
  }

  const validation = validatePropose({
    currentScheduledAt: new Date(booking.scheduled_at),
    proposedNewAt,
    rescheduleCount: booking.reschedule_count ?? 0,
    hasPendingProposal: !!booking.reschedule_proposed_at,
  });
  if (validation) return NextResponse.json({ error: validation.message, code: validation.code }, { status: 400 });

  // Monthly-limit check: how many bookings has THIS user already initiated a reschedule
  // proposal for with THIS counterpart in the last 30 days? We count completed reschedules
  // (rescheduled_from IS NOT NULL) PLUS currently-pending proposals.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const counterpartFilter = isStudent
    ? { col: 'teacher_id', val: booking.teacher.id }
    : { col: 'student_id', val: booking.student_id };

  const { count: recentReschedules } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq(counterpartFilter.col, counterpartFilter.val)
    .eq(isStudent ? 'student_id' : 'teacher_id', isStudent ? user.id : booking.teacher.id)
    .or(`rescheduled_from.gte.${since},reschedule_proposed_at.gte.${since}`);

  const limitError = withinMonthlyLimit(recentReschedules ?? 0);
  if (limitError) return NextResponse.json({ error: limitError.message, code: limitError.code }, { status: 400 });

  // Write the proposal via service role (the bookings_guard trigger doesn't lock these
  // columns, but service role keeps the path consistent with accept/decline).
  const admin = createServiceRoleClient();
  const { error: updErr } = await admin
    .from('bookings')
    .update({
      reschedule_proposed_by: user.id,
      reschedule_proposed_at: new Date().toISOString(),
      reschedule_proposed_new_at: proposedNewAt.toISOString(),
      reschedule_proposal_reason: reason,
    })
    .eq('id', booking.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Notify the OTHER party (best-effort).
  try {
    const recipient = isStudent
      ? { fullName: booking.teacher.profile.full_name, email: booking.teacher.profile.email }
      : { fullName: booking.student.full_name, email: booking.student.email };
    const proposerName = isStudent ? booking.student.full_name : booking.teacher.profile.full_name;
    await notifyReschedulProposed({
      recipient,
      proposerName,
      oldScheduledAt: new Date(booking.scheduled_at),
      proposedNewAt,
      reason,
      dashboardHref: `${APP_URL}/${isStudent ? 'teacher/' : ''}dashboard`,
    });
  } catch (e) {
    console.error('[reschedule/propose] notify failed:', e);
  }

  return NextResponse.json({ ok: true });
}
