import { NextResponse } from 'next/server';

// Cron routes are scheduled GET requests from Vercel Cron. Vercel automatically
// includes `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set.
// We also accept ?key=<CRON_SECRET> for manual triggering. Reject everything else.

export function assertCron(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (auth === `Bearer ${secret}` || key === secret) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Window helper: returns [start, end] ISO strings for "between now+min and now+max minutes".
export function futureWindow(minMinutes: number, maxMinutes: number): { startISO: string; endISO: string } {
  const now = Date.now();
  return {
    startISO: new Date(now + minMinutes * 60_000).toISOString(),
    endISO: new Date(now + maxMinutes * 60_000).toISOString(),
  };
}
