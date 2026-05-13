import { NextResponse } from 'next/server';
import { assertCron } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// Nudge students who are down to their last credit. Runs daily; at most once per
// student per 7 days (low_credit_warned_at cooldown).

interface Row { student_id: string; credits_balance: number; student: { full_name: string; email: string } }

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await admin
    .from('student_credits')
    .select('student_id, credits_balance, low_credit_warned_at, student:profiles!student_credits_student_id_fkey(full_name, email)')
    .eq('credits_balance', 1)
    .or(`low_credit_warned_at.is.null,low_credit_warned_at.lt.${weekAgo}`)
    .limit(200)
    .returns<(Row & { low_credit_warned_at: string | null })[]>();

  let warned = 0;
  for (const r of rows ?? []) {
    if (r.student?.email) {
      await sendEmail({
        to: r.student.email,
        subject: 'You have 1 session credit left',
        html: `<p>Namaste ${r.student.full_name},</p><p>You're down to your last session credit. Top up so you can keep booking — credits never expire.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.com'}/credits">Buy a credit pack</a></p><p>— Naadvidya</p>`,
      });
    }
    await admin.from('student_credits').update({ low_credit_warned_at: new Date().toISOString() }).eq('student_id', r.student_id);
    warned++;
  }
  return NextResponse.json({ ok: true, warned });
}
