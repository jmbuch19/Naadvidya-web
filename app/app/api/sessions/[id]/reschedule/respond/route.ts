import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createRoom, isDailyConfigured } from '@/lib/daily';
import { notifyRescheduleAccepted, notifyRescheduleDeclined } from '@/lib/notifications';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.naadvidya.com';

interface SessionDetail {
  id: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  reschedule_count: number;
  reschedule_proposed_by: string | null;
  reschedule_proposed_new_at: string | null;
  reschedule_proposal_reason: string | null;
  daily_room_name: string | null;
  student_id: string;
  teacher: {
    profile_id: string;
    profile: { full_name: string; email: string };
  };
  student: { full_name: string; email: string };
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

  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, status, scheduled_at, duration_minutes, reschedule_count,
      reschedule_proposed_by, reschedule_proposed_new_at, reschedule_proposal_reason,
      daily_room_name, student_id,
      teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(
        profile_id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)
      ),
      student:profiles!scheduled_sessions_student_id_fkey(full_name, email)
    `)
    .eq('id', params.id)
    .maybeSingle<SessionDetail>();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (!session.reschedule_proposed_by || !session.reschedule_proposed_new_at) {
    return NextResponse.json({ error: 'No pending reschedule proposal for this session.' }, { status: 400 });
  }

  const isStudent = session.student_id === user.id;
  const isTeacher = session.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  if (session.reschedule_proposed_by === user.id) {
    return NextResponse.json({ error: 'You proposed this reschedule — the other party must accept or decline.' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const proposedNewAt = new Date(session.reschedule_proposed_new_at);
  const proposerIsStudent = session.reschedule_proposed_by === session.student_id;
  const proposerName = proposerIsStudent ? session.student.full_name : session.teacher.profile.full_name;
  const proposerEmail = proposerIsStudent ? session.student.email : session.teacher.profile.email;
  const responderName = isStudent ? session.student.full_name : session.teacher.profile.full_name;

  if (body.action === 'decline') {
    const { error } = await admin
      .from('scheduled_sessions')
      .update({
        reschedule_proposed_by: null,
        reschedule_proposed_at: null,
        reschedule_proposed_new_at: null,
        reschedule_proposal_reason: null,
      })
      .eq('id', session.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await notifyRescheduleDeclined({
        recipient: { fullName: proposerName, email: proposerEmail },
        responderName,
        originalScheduledAt: new Date(session.scheduled_at),
        dashboardHref: `${APP_URL}/${proposerIsStudent ? '' : 'teacher/'}dashboard`,
      });
    } catch (e) { console.error('[sessions/reschedule decline] notify failed:', e); }

    return NextResponse.json({ ok: true, action: 'decline' });
  }

  // accept — regen Daily.co room around the new start time.
  let newRoomName = session.daily_room_name;
  let newRoomUrl: string | null = null;
  if (isDailyConfigured()) {
    try {
      const room = await createRoom({
        prefix: 's',
        id: session.id,
        scheduledAt: proposedNewAt,
        durationMinutes: session.duration_minutes,
      });
      newRoomName = room.name;
      newRoomUrl = room.url;
    } catch (e) {
      console.error('[sessions/reschedule accept] daily room regen failed:', e);
    }
  }

  const updatePayload: Record<string, unknown> = {
    scheduled_at: proposedNewAt.toISOString(),
    rescheduled_from: session.scheduled_at,
    rescheduled_reason: session.reschedule_proposal_reason,
    reschedule_count: (session.reschedule_count ?? 0) + 1,
    reschedule_proposed_by: null,
    reschedule_proposed_at: null,
    reschedule_proposed_new_at: null,
    reschedule_proposal_reason: null,
    reminded_24hr: false,
    reminded_1hr: false,
    reminded_start: false,
  };
  if (newRoomName) updatePayload.daily_room_name = newRoomName;
  if (newRoomUrl) updatePayload.daily_room_url = newRoomUrl;

  const { error: updErr } = await admin.from('scheduled_sessions').update(updatePayload).eq('id', session.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  try {
    await notifyRescheduleAccepted({
      recipient: { fullName: proposerName, email: proposerEmail },
      responderName,
      newScheduledAt: proposedNewAt,
      dashboardHref: `${APP_URL}/${proposerIsStudent ? '' : 'teacher/'}dashboard`,
    });
  } catch (e) { console.error('[sessions/reschedule accept] notify failed:', e); }

  return NextResponse.json({ ok: true, action: 'accept', new_scheduled_at: proposedNewAt.toISOString() });
}
