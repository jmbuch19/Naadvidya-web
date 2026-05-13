import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Student withdraws from an enrolment.
// Refund policy (CANCELLATION_REFUND_POLICY §2.2/§2.3) — Phase 1.5 simplification:
//   refund 1 credit per session that hasn't happened yet (status 'upcoming'),
//   cancel those upcoming scheduled_sessions, mark the enrolment 'withdrawn'.
// (The 10% admin fee / first-14-days nuances are deferred.)

interface Body { reason?: string }
interface Row { id: string; status: string; student_id: string; credits_reserved: number }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body = {};
  try { body = await req.json(); } catch { /* no body ok */ }

  const { data: enr } = await supabase
    .from('enrollments').select('id, status, student_id, credits_reserved').eq('id', params.id).maybeSingle<Row>();
  if (!enr) return NextResponse.json({ error: 'Enrolment not found' }, { status: 404 });
  if (enr.student_id !== user.id) return NextResponse.json({ error: 'Not your enrolment' }, { status: 403 });
  if (!['pending', 'active', 'paused'].includes(enr.status)) {
    return NextResponse.json({ error: `Enrolment is already ${enr.status}.` }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Count upcoming sessions → that's how many credits to refund.
  const { count: upcomingCount } = await admin
    .from('scheduled_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('enrollment_id', enr.id)
    .eq('status', 'upcoming');
  const refund = Math.min(enr.credits_reserved, upcomingCount ?? 0);

  if (refund > 0) {
    const { error: rpcErr } = await admin.rpc('apply_credit_change', {
      p_student_id: enr.student_id, p_type: 'refund', p_credits: refund,
      p_note: `Withdrew from enrolment — ${refund} unused session(s) refunded${body.reason ? `: ${body.reason}` : ''}`,
    });
    if (rpcErr) return NextResponse.json({ error: `Refund failed: ${rpcErr.message}` }, { status: 500 });
  }

  // Cancel the upcoming sessions.
  await admin.from('scheduled_sessions').update({ status: 'cancelled' }).eq('enrollment_id', enr.id).eq('status', 'upcoming');

  const { error } = await admin
    .from('enrollments')
    .update({ status: 'withdrawn', withdrawal_date: new Date().toISOString().slice(0, 10), withdrawal_reason: body.reason?.trim() || null })
    .eq('id', enr.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: 'withdrawn', refunded: refund });
}
