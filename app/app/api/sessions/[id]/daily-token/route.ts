import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createRoom, createMeetingToken, isDailyConfigured } from '@/lib/daily';

// Returns { roomUrl, token } for a scheduled session. Creates the Daily.co room
// lazily on first request (no cron yet) and persists it on the row.

interface Row {
  id: string; status: string; scheduled_at: string; duration_minutes: number;
  daily_room_name: string | null; daily_room_url: string | null;
  student_id: string; teacher: { profile_id: string };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: s } = await supabase
    .from('scheduled_sessions')
    .select('id, status, scheduled_at, duration_minutes, daily_room_name, daily_room_url, student_id, teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile_id)')
    .eq('id', params.id)
    .maybeSingle<Row>();
  if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const isStudent = s.student_id === user.id;
  const isTeacher = s.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  if (s.status !== 'upcoming') return NextResponse.json({ error: `Session is ${s.status} — room not active` }, { status: 400 });

  if (!isDailyConfigured()) {
    return NextResponse.json({ token: 'mock-token-dev', roomUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/session/s/${s.id}?mock=1`, mock: true });
  }

  let roomName = s.daily_room_name;
  let roomUrl = s.daily_room_url;
  if (!roomName || !roomUrl) {
    try {
      const room = await createRoom({ prefix: 's', id: s.id, scheduledAt: new Date(s.scheduled_at), durationMinutes: s.duration_minutes });
      roomName = room.name; roomUrl = room.url;
      const admin = createServiceRoleClient();
      await admin.from('scheduled_sessions').update({ daily_room_name: roomName, daily_room_url: roomUrl }).eq('id', s.id);
    } catch (e) {
      console.error('[sessions/daily-token] room creation failed:', e);
      return NextResponse.json({ error: 'Video room creation failed' }, { status: 502 });
    }
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle<{ full_name: string }>();
  try {
    const scheduledAt = new Date(s.scheduled_at);
    const expSeconds = Math.floor(scheduledAt.getTime() / 1000) + s.duration_minutes * 60 + 3600;
    const token = await createMeetingToken({ roomName, isTeacher, userName: profile?.full_name ?? (isTeacher ? 'Teacher' : 'Student'), expSeconds });
    return NextResponse.json({ token, roomUrl });
  } catch (e) {
    console.error('[sessions/daily-token] token failed:', e);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 502 });
  }
}
