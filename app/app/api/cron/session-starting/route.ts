import { NextResponse } from 'next/server';
import { assertCron, futureWindow } from '@/lib/cron';
import { runSessionReminders } from '@/lib/cron-reminders';

export const dynamic = 'force-dynamic';

// "Starting now" nudge. Runs every 5 min. Window ~ -3 min .. +8 min around now.
export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const { startISO, endISO } = futureWindow(-3, 8);
  const notified = await runSessionReminders('start', startISO, endISO);
  return NextResponse.json({ ok: true, notified });
}
