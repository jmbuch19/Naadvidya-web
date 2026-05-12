import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isR2Configured, presignUpload, buildVoiceRepoAudioKey, buildVoiceRepoPdfKey } from '@/lib/r2';

// Teacher gets a presigned PUT URL for a Voice Repo upload (audio or notation PDF).
// The browser uploads directly to R2; then calls /api/voice-repo/create with the key.

interface Body {
  kind?: 'audio' | 'pdf';
  contentType?: string;
  fileSizeKb?: number;
}

const MAX_KB = 50_000;

export async function POST(req: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'File storage not configured (R2_*)' }, { status: 503 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.kind || !body.contentType) {
    return NextResponse.json({ error: 'kind and contentType required' }, { status: 400 });
  }
  if (body.kind === 'audio' && !body.contentType.startsWith('audio/')) {
    return NextResponse.json({ error: 'audio uploads must be an audio/* type' }, { status: 400 });
  }
  if (body.kind === 'pdf' && body.contentType !== 'application/pdf') {
    return NextResponse.json({ error: 'pdf uploads must be application/pdf' }, { status: 400 });
  }
  if (body.fileSizeKb && body.fileSizeKb > MAX_KB) {
    return NextResponse.json({ error: `File too large — max ${MAX_KB} KB` }, { status: 413 });
  }

  const key = body.kind === 'audio'
    ? buildVoiceRepoAudioKey(teacher.id, body.contentType)
    : buildVoiceRepoPdfKey(teacher.id);

  try {
    const uploadUrl = await presignUpload({ key, contentType: body.contentType });
    return NextResponse.json({ uploadUrl, key });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Presign failed' }, { status: 500 });
  }
}
