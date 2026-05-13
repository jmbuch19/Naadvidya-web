import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Teacher marks a scheduled session complete. Increments the enrolment's
// sessions_completed; if that reaches sessions_total, the enrolment is 'completed'.
// (Payout records for class-type sessions need a small payouts-table tweak — TODO,
// tracked separately. Mehfil payouts are unaffected.)

interface Row {
  id: string; status: string; enrollment_id: string | null;
  teacher: { profile_id: string };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: s } = await supabase
    .from('scheduled_sessions')
    .select('id, status, enrollment_id, teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile_id)')
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

  return NextResponse.json({ ok: true, status: 'completed' });
}
