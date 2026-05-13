import { NextResponse } from 'next/server';
import { assertCron } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// "It's payout day" reminder for Amee. Scheduled for the 1st and 15th, ~8:00 IST.

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();

  const { data: amee } = await admin.from('profiles').select('full_name, email').eq('is_owner', true).maybeSingle<{ full_name: string; email: string }>();
  if (!amee?.email) return NextResponse.json({ ok: true, skipped: 'no owner_admin' });

  const { data: pending } = await admin.from('payouts').select('teacher_id, teacher_amount').eq('status', 'pending').returns<{ teacher_id: string; teacher_amount: number }[]>();
  const rows = pending ?? [];
  const total = rows.reduce((s, p) => s + Number(p.teacher_amount), 0);
  const teacherCount = new Set(rows.map((p) => p.teacher_id)).size;
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.com';

  await sendEmail({
    to: amee.email,
    subject: `Payout day — ₹${Math.round(total).toLocaleString('en-IN')} due across ${teacherCount} teacher${teacherCount === 1 ? '' : 's'}`,
    html: `<p>Namaste ${amee.full_name},</p><p>It's the ${new Date().getDate() <= 7 ? '1st' : '15th'} — payout day. There ${rows.length === 1 ? 'is' : 'are'} <strong>${rows.length}</strong> pending payout record${rows.length === 1 ? '' : 's'} totalling <strong>₹${Math.round(total).toLocaleString('en-IN')}</strong> across ${teacherCount} teacher${teacherCount === 1 ? '' : 's'}. Balances below ₹500 roll over.</p><p><a href="${url}/admin/payouts">Open the payouts page</a> — it shows each teacher's UPI/bank details. Mark each one paid with the reference after you transfer.</p><p>— Naadvidya</p>`,
  });
  return NextResponse.json({ ok: true, pendingRecords: rows.length, total: Math.round(total) });
}
