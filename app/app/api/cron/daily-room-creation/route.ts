import { NextResponse } from 'next/server';
import { assertCron, futureWindow } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { createRoom, isDailyConfigured } from '@/lib/daily';

export const dynamic = 'force-dynamic';

// Pre-create Daily.co rooms for scheduled (Workshop/Gurukul) sessions happening in the
// next 24h that don't have one yet. (Mehfil bookings get their room at confirm time.)
// Rooms have an expiry, so we only create them shortly before. Runs daily ~6:00 IST.

interface Row { id: string; scheduled_at: string; duration_minutes: number }

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  if (!isDailyConfigured()) return NextResponse.json({ ok: true, skipped: 'Daily.co not configured' });

  const admin = createServiceRoleClient();
  const { startISO, endISO } = futureWindow(0, 24 * 60);
  const { data: rows } = await admin
    .from('scheduled_sessions')
    .select('id, scheduled_at, duration_minutes')
    .eq('status', 'upcoming')
    .is('daily_room_name', null)
    .gte('scheduled_at', startISO)
    .lte('scheduled_at', endISO)
    .limit(80)
    .returns<Row[]>();

  let created = 0;
  for (const s of rows ?? []) {
    try {
      const room = await createRoom({ prefix: 's', id: s.id, scheduledAt: new Date(s.scheduled_at), durationMinutes: s.duration_minutes });
      await admin.from('scheduled_sessions').update({ daily_room_name: room.name, daily_room_url: room.url }).eq('id', s.id);
      created++;
    } catch (e) {
      console.error('[cron/daily-room-creation] failed for', s.id, e);
    }
  }
  return NextResponse.json({ ok: true, created });
}
