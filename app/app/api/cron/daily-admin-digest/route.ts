import { NextResponse } from 'next/server';
import { assertCron } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// Morning summary for Amee. Runs daily ~9:00 IST.

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();

  const { data: amee } = await admin.from('profiles').select('full_name, email').eq('is_owner', true).maybeSingle<{ full_name: string; email: string }>();
  if (!amee?.email) return NextResponse.json({ ok: true, skipped: 'no owner_admin' });

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  const [pendingTeachers, pendingOfferings, pendingBookings, openDisputes, pendingPayouts, bookingsToday, scheduledToday] = await Promise.all([
    admin.from('teacher_profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    admin.from('class_offerings').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    admin.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('disputes').select('*', { count: 'exact', head: true }).in('status', ['open', 'under_review', 'escalated']),
    admin.from('payouts').select('teacher_amount', { count: 'exact' }).eq('status', 'pending'),
    admin.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed').gte('scheduled_at', startOfDay.toISOString()).lte('scheduled_at', endOfDay.toISOString()),
    admin.from('scheduled_sessions').select('*', { count: 'exact', head: true }).eq('status', 'upcoming').gte('scheduled_at', startOfDay.toISOString()).lte('scheduled_at', endOfDay.toISOString()),
  ]);

  const payoutTotal = (pendingPayouts.data ?? []).reduce((s: number, p: { teacher_amount: number }) => s + Number(p.teacher_amount), 0);
  const sessionsToday = (bookingsToday.count ?? 0) + (scheduledToday.count ?? 0);
  const url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.com';

  const lines = [
    `Sessions today: ${sessionsToday}`,
    `Teacher applications awaiting review: ${pendingTeachers.count ?? 0}`,
    `Workshop/Programme submissions awaiting review: ${pendingOfferings.count ?? 0}`,
    `Mehfil booking requests awaiting teacher confirmation: ${pendingBookings.count ?? 0}`,
    `Open disputes: ${openDisputes.count ?? 0}`,
    `Pending payouts: ${pendingPayouts.count ?? 0} record(s), ₹${Math.round(payoutTotal).toLocaleString('en-IN')} total`,
  ];

  await sendEmail({
    to: amee.email,
    subject: `Naadvidya — daily summary (${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })})`,
    html: `<p>Namaste ${amee.full_name},</p><p>Today on Naadvidya:</p><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul><p><a href="${url}/admin/dashboard">Open the admin dashboard</a></p><p>— Naadvidya</p>`,
    text: lines.join('\n') + `\n${url}/admin/dashboard`,
  });

  return NextResponse.json({ ok: true, sessionsToday });
}
