import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createDailyRoom, isDailyConfigured } from '@/lib/daily';
import { notifyRescheduleAccepted, notifyRescheduleDeclined } from '@/lib/notifications';

// POST = respond to a pending reschedule proposal. Body: { action: 'accept' | 'decline' }
// Caller must be the OTHER party (not the initiator).

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.naadvidya.com';

interface BookingDetail {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  reschedule_count: number;
  reschedule_proposed_by: string | null;
  reschedule_proposed_new_at: string | null;
  reschedule_proposal_reason: string | null;
  daily_room_name: string | null;
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

  let body: { action?: 'accept' | 'decline' };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (body.action !== 'accept' && body.action !== 'decline') {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, reschedule_count,
      reschedule_proposed_by, reschedule_proposed_new_at, reschedule_proposal_reason,
      daily_room_name, student_id,
      student:profiles!bookings_student_id_fkey(full_name, email),
      teacher:teacher_profiles!bookings_teacher_id_fkey(
        id, profile_id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)
      )
    `)
    .eq('id', params.id)
    .maybeSingle<BookingDetail>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (!booking.reschedule_proposed_by || !booking.reschedule_proposed_new_at || !booking.scheduled_at) {
    return NextResponse.json({ error: 'No pending reschedule proposal for this booking.' }, { status: 400 });
  }

  const isStudent = booking.student_id === user.id;
  const isTeacher = booking.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  if (booking.reschedule_proposed_by === user.id) {
    return NextResponse.json({ error: 'You proposed this reschedule — the other party must accept or decline.' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const proposedNewAt = new Date(booking.reschedule_proposed_new_at);
  const proposerIsStudent = booking.reschedule_proposed_by === booking.student_id;
  const proposerName = proposerIsStudent ? booking.student.full_name : booking.teacher.profile.full_name;
  const proposerEmail = proposerIsStudent ? booking.student.email : booking.teacher.profile.email;
  const responderName = isStudent ? booking.student.full_name : booking.teacher.profile.full_name;

  if (body.action === 'decline') {
    const { error } = await admin
      .from('bookings')
      .update({
        reschedule_proposed_by: null,
        reschedule_proposed_at: null,
        reschedule_proposed_new_at: null,
        reschedule_proposal_reason: null,
      })
      .eq('id', booking.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await notifyRescheduleDeclined({
        recipient: { fullName: proposerName, email: proposerEmail },
        responderName,
        originalScheduledAt: new Date(booking.scheduled_at),
        dashboardHref: `${APP_URL}/${proposerIsStudent ? '' : 'teacher/'}dashboard`,
      });
    } catch (e) { console.error('[reschedule/respond decline] notify failed:', e); }

    return NextResponse.json({ ok: true, action: 'decline' });
  }

  // accept — move the session.
  // Regenerate the Daily.co room so the old URL stops working (existing room was
  // scheduled around the OLD start; expiry windows would be wrong).
  let newRoomName = booking.daily_room_name;
  let newRoomUrl: string | null = null;
  if (isDailyConfigured()) {
    try {
      const room = await createDailyRoom({
        bookingId: booking.id,
        scheduledAt: proposedNewAt,
        durationMinutes: booking.duration_minutes,
      });
      newRoomName = room.name;
      newRoomUrl = room.url;
    } catch (e) {
      console.error('[reschedule/respond accept] daily room regen failed:', e);
      // Non-fatal — the cron daily-room-creation job will regenerate later.
    }
  }

  const updatePayload: Record<string, unknown> = {
    scheduled_at: proposedNewAt.toISOString(),
    rescheduled_from: booking.scheduled_at,
    rescheduled_reason: booking.reschedule_proposal_reason,
    reschedule_count: (booking.reschedule_count ?? 0) + 1,
    reschedule_proposed_by: null,
    reschedule_proposed_at: null,
    reschedule_proposed_new_at: null,
    reschedule_proposal_reason: null,
    // Clear reminder flags so the new time gets a fresh reminder cycle.
    reminded_24hr: false,
    reminded_1hr: false,
    reminded_start: false,
  };
  if (newRoomName) updatePayload.daily_room_name = newRoomName;
  if (newRoomUrl) updatePayload.daily_room_url = newRoomUrl;

  const { error: updErr } = await admin.from('bookings').update(updatePayload).eq('id', booking.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Notify proposer that the move went through.
  try {
    await notifyRescheduleAccepted({
      recipient: { fullName: proposerName, email: proposerEmail },
      responderName,
      newScheduledAt: proposedNewAt,
      dashboardHref: `${APP_URL}/${proposerIsStudent ? '' : 'teacher/'}dashboard`,
    });
  } catch (e) { console.error('[reschedule/respond accept] notify failed:', e); }

  return NextResponse.json({ ok: true, action: 'accept', new_scheduled_at: proposedNewAt.toISOString() });
}
