import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createAnonClient } from '@/lib/supabase/anon';
import { presignStream } from '@/lib/r2';

// Returns a short-lived (1h) streaming URL for a voice-repo recording.
//
// Access control:
//  - Logged-out visitors: only the public sample (anon client + RLS "public sample" policy).
//  - Logged-in users: RLS allows the public sample, recordings of teachers they've booked
//    (confirmed/completed), and the teacher's own recordings.
//
// play_count is incremented for everyone EXCEPT the owning teacher (keeps the
// "which recordings do students replay most" signal clean).

interface Row {
  id: string;
  teacher_id: string;
  file_key: string;
  is_active: boolean;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let row: Row | null = null;
  if (user) {
    const { data } = await supabase
      .from('voice_repo')
      .select('id, teacher_id, file_key, is_active')
      .eq('id', params.id)
      .maybeSingle<Row>();
    row = data ?? null;
  } else {
    const anon = createAnonClient();
    const { data } = await anon
      .from('voice_repo')
      .select('id, teacher_id, file_key, is_active')
      .eq('id', params.id)
      .maybeSingle<Row>();
    row = data ?? null;
  }

  if (!row || !row.is_active) {
    return NextResponse.json({ error: 'Recording not available' }, { status: 404 });
  }

  let isOwnTeacher = false;
  if (user) {
    const { data: ownTeacher } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('profile_id', user.id)
      .eq('id', row.teacher_id)
      .maybeSingle<{ id: string }>();
    isOwnTeacher = !!ownTeacher;
  }

  let streamUrl: string;
  try {
    streamUrl = await presignStream(row.file_key);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Stream URL failed' }, { status: 500 });
  }

  if (!isOwnTeacher) {
    try {
      const admin = createServiceRoleClient();
      await admin.rpc('increment_voice_repo_play_count', { p_id: row.id });
    } catch (e) {
      console.warn('[voice-repo/play] increment failed:', e);
    }
  }

  return NextResponse.json({ streamUrl });
}
