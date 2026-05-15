import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { validatePropose, withinMonthlyLimit } from '@/lib/reschedule';
import { notifyReschedulProposed } from '@/lib/notifications';

// POST = propose a reschedule for a scheduled_session (Gurukul Path).
// Body: { new_scheduled_at: ISO string, reason: string }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.naadvidya.com';

interface SessionDetail {
  id: string;
  status: string;
  scheduled_at: string;
  reschedule_count: number;
  reschedule_proposed_at: string | null;
  student_id: string;
  teacher_id: string;
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

  let body: { new_scheduled_at?: string; reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const newAtRaw = body.new_scheduled_at;
  const reason = (body.reason ?? '').trim();
  if (!newAtRaw || reason.length < 5) {
    return NextResponse.json({ error: 'new_scheduled_at and a reason (min 5 chars) are required' }, { status: 400 });
  }
  const proposedNewAt = new Date(newAtRaw);

  const { data: session } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, status, scheduled_at, reschedule_count, reschedule_proposed_at,
      student_id, teacher_id,
      teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(
        profile_id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)
      ),
      student:profiles!scheduled_sessions_student_id_fkey(full_name, email)
    `)
    .eq('id', params.id)
    .maybeSingle<SessionDetail>();

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const isStudent = session.student_id === user.id;
  const isTeacher = session.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  if (session.status !== 'upcoming') {
    return NextResponse.json({ error: `Cannot reschedule a ${session.status} session.` }, { status: 400 });
  }

  const validation = validatePropose({
    currentScheduledAt: new Date(session.scheduled_at),
    proposedNewAt,
    rescheduleCount: session.reschedule_count ?? 0,
    hasPendingProposal: !!session.reschedule_proposed_at,
  });
  if (validation) return NextResponse.json({ error: validation.message, code: validation.code }, { status: 400 });

  // Monthly-limit check: count recent reschedules initiated by this user against this
  // counterpart across scheduled_sessions in the last 30 days.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentReschedules } = await supabase
    .from('scheduled_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', session.teacher_id)
    .eq('student_id', session.student_id)
    .or(`rescheduled_from.gte.${since},reschedule_proposed_at.gte.${since}`);

  const limitError = withinMonthlyLimit(recentReschedules ?? 0);
  if (limitError) return NextResponse.json({ error: limitError.message, code: limitError.code }, { status: 400 });

  const admin = createServiceRoleClient();
  const { error: updErr } = await admin
    .from('scheduled_sessions')
    .update({
      reschedule_proposed_by: user.id,
      reschedule_proposed_at: new Date().toISOString(),
      reschedule_proposed_new_at: proposedNewAt.toISOString(),
      reschedule_proposal_reason: reason,
    })
    .eq('id', session.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  try {
    const recipient = isStudent
      ? { fullName: session.teacher.profile.full_name, email: session.teacher.profile.email }
      : { fullName: session.student.full_name, email: session.student.email };
    const proposerName = isStudent ? session.student.full_name : session.teacher.profile.full_name;
    await notifyReschedulProposed({
      recipient,
      proposerName,
      oldScheduledAt: new Date(session.scheduled_at),
      proposedNewAt,
      reason,
      dashboardHref: `${APP_URL}/${isStudent ? 'teacher/' : ''}dashboard`,
    });
  } catch (e) { console.error('[sessions/reschedule] notify failed:', e); }

  return NextResponse.json({ ok: true });
}
