import { NextResponse } from 'next/server';
import { assertCron, futureWindow } from '@/lib/cron';
import { runSessionReminders } from '@/lib/cron-reminders';

export const dynamic = 'force-dynamic';

// "In about an hour" reminder. Runs every 15 min. Window ~5–75 min out.
export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const { startISO, endISO } = futureWindow(5, 75);
  const notified = await runSessionReminders('1hr', startISO, endISO);
  return NextResponse.json({ ok: true, notified });
}
