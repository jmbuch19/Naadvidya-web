import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Teacher marks a scheduled session complete. Increments the enrolment's
// sessions_completed; if that reaches sessions_total, the enrolment is 'completed'.
// Also creates a payout record (80/20 split; 100% if the teacher is the owner).

interface Row {
  id: string; status: string; enrollment_id: string | null; teacher_id: string;
  teacher: { profile_id: string; profile: { is_owner: boolean } };
  enrollment: { offering: { price_per_session_inr: number } } | null;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: s } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, status, enrollment_id, teacher_id,
      teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile_id, profile:profiles!teacher_profiles_profile_id_fkey(is_owner)),
      enrollment:enrollments!scheduled_sessions_enrollment_id_fkey(offering:class_offerings!enrollments_offering_id_fkey(price_per_session_inr))
    `)
    .eq('id', params.id)
    .maybeSingle<Row>();
  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (s.teacher.profile_id !== user.id) return NextResponse.json({ error: 'Only the teacher can mark complete' }, { status: 403 });
  if (s.status !== 'upcoming') return NextResponse.json({ error: `Session is ${s.status}, cannot complete` }, { status: 400 });

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('scheduled_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', s.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump the enrolment's completed count (→ 'completed' when all sessions are done).
  if (s.enrollment_id) {
    const { data: enr } = await admin
      .from('enrollments').select('id, sessions_completed, sessions_total').eq('id', s.enrollment_id).maybeSingle<{ id: string; sessions_completed: number; sessions_total: number | null }>();
    if (enr) {
      const done = (enr.sessions_completed ?? 0) + 1;
      const patch: Record<string, unknown> = { sessions_completed: done };
      if (enr.sessions_total && done >= enr.sessions_total) patch.status = 'completed';
      await admin.from('enrollments').update(patch).eq('id', enr.id);
    }
  }

  // Payout record (best-effort — don't fail the completion if this errors).
  try {
    const gross = Number(s.enrollment?.offering?.price_per_session_inr ?? 0);
    if (gross > 0) {
      const isOwnerSession = !!s.teacher.profile?.is_owner;
      const platformCut = isOwnerSession ? 0 : Math.round(gross * 0.2 * 100) / 100;
      const teacherAmount = isOwnerSession ? gross : Math.round(gross * 0.8 * 100) / 100;
      const { error: payErr } = await admin.from('payouts').insert({
        teacher_id: s.teacher_id,
        scheduled_session_id: s.id,
        gross_amount: gross,
        platform_cut: platformCut,
        teacher_amount: teacherAmount,
        is_owner_session: isOwnerSession,
        status: 'pending',
      });
      if (payErr) console.error('[sessions/complete] payout insert failed:', payErr);
    }
  } catch (e) {
    console.error('[sessions/complete] payout block failed:', e);
  }

  return NextResponse.json({ ok: true, status: 'completed' });
}
