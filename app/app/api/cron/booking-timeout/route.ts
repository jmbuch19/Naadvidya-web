import { NextResponse } from 'next/server';
import { assertCron } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// Auto-cancel Mehfil booking requests the teacher hasn't acted on within 24h, and
// refund the student's credit (SCHEDULING_HOLIDAY_POLICY §1.2). Runs every 30 min.

interface Row {
  id: string; student_id: string; is_trial: boolean; credits_deducted: number;
  student: { full_name: string; email: string };
  teacher: { profile: { full_name: string } };
}

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await admin
    .from('bookings')
    .select('id, student_id, is_trial, credits_deducted, student:profiles!bookings_student_id_fkey(full_name, email), teacher:teacher_profiles!bookings_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name))')
    .eq('status', 'pending')
    .lt('requested_at', cutoff)
    .limit(100)
    .returns<Row[]>();

  let cancelled = 0;
  for (const b of rows ?? []) {
    if (!b.is_trial && b.credits_deducted > 0) {
      await admin.rpc('apply_credit_change', { p_student_id: b.student_id, p_type: 'refund', p_credits: b.credits_deducted, p_booking_id: b.id, p_note: 'Auto-cancelled — teacher did not respond within 24h' });
    }
    const { error } = await admin.from('bookings').update({ status: 'cancelled', cancelled_reason: 'Auto-cancelled — no teacher response within 24h', cancelled_at: new Date().toISOString() }).eq('id', b.id);
    if (error) continue;
    cancelled++;
    if (b.student?.email) {
      await sendEmail({
        to: b.student.email,
        subject: 'Your session request expired — credit refunded',
        html: `<p>Namaste ${b.student.full_name},</p><p>Your session request with ${b.teacher?.profile?.full_name ?? 'the teacher'} expired because it wasn't confirmed within 24 hours.${!b.is_trial ? ' Your credit has been refunded to your wallet.' : ''}</p><p>You can rebook anytime — try another slot or another teacher.</p><p>— Naadvidya</p>`,
      });
    }
  }
  return NextResponse.json({ ok: true, cancelled });
}
