import { NextResponse } from 'next/server';
import { assertCron, futureWindow } from '@/lib/cron';
import { runSessionReminders } from '@/lib/cron-reminders';

export const dynamic = 'force-dynamic';

// Day-before reminder. Runs hourly. Catches confirmed sessions between ~1h and 24h
// out that haven't had this reminder yet (imminent ones are handled by the 1hr job).
export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const { startISO, endISO } = futureWindow(60, 24 * 60);
  const notified = await runSessionReminders('24hr', startISO, endISO);
  return NextResponse.json({ ok: true, notified });
}
