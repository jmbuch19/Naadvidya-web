import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Insert a voice_repo row after the browser has uploaded the audio (and optional PDF)
// to R2 via /api/voice-repo/presign. RLS ensures teacher_id belongs to the caller.

type Category = 'demonstration' | 'alankaar' | 'bandish' | 'taal_theka' | 'pronunciation' | 'improvisation' | 'correction' | 'general';
const CATEGORIES: Category[] = ['demonstration', 'alankaar', 'bandish', 'taal_theka', 'pronunciation', 'improvisation', 'correction', 'general'];

interface Body {
  title: string;
  description?: string | null;
  raga?: string | null;
  taal?: string | null;
  category?: Category;
  levelMin?: number;
  levelMax?: number;
  fileKey: string;            // R2 key from presign
  fileSizeKb?: number;
  durationSeconds?: number;
  notesText?: string | null;
  notesPdfKey?: string | null;
  collectionId?: string | null;
  makePublicSample?: boolean;
}

export async function POST(req: Request) {
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
  if (!body.title?.trim() || !body.fileKey) {
    return NextResponse.json({ error: 'title and fileKey required' }, { status: 400 });
  }
  const category: Category = body.category && CATEGORIES.includes(body.category) ? body.category : 'general';
  const levelMin = clampLevel(body.levelMin ?? 0);
  const levelMax = clampLevel(body.levelMax ?? 7);
  if (levelMax < levelMin) {
    return NextResponse.json({ error: 'levelMax must be >= levelMin' }, { status: 400 });
  }

  // If the teacher wants this as their public sample, clear any existing one first
  // (the DB has a unique partial index that would otherwise reject the insert).
  if (body.makePublicSample) {
    await supabase
      .from('voice_repo')
      .update({ is_public_sample: false })
      .eq('teacher_id', teacher.id)
      .eq('is_public_sample', true);
  }

  const { data, error } = await supabase
    .from('voice_repo')
    .insert({
      teacher_id: teacher.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      raga: body.raga?.trim() || null,
      taal: body.taal?.trim() || null,
      category,
      level_min: levelMin,
      level_max: levelMax,
      file_url: body.fileKey,        // store key; we always re-presign on read
      file_key: body.fileKey,
      file_size_kb: body.fileSizeKb ?? null,
      duration_seconds: body.durationSeconds ?? null,
      notes_text: body.notesText?.trim() || null,
      notes_pdf_url: body.notesPdfKey ?? null,
      notes_pdf_key: body.notesPdfKey ?? null,
      collection_id: body.collectionId ?? null,
      is_public_sample: body.makePublicSample === true,
      is_active: true,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

function clampLevel(n: number): number {
  if (typeof n !== 'number' || isNaN(n)) return 0;
  return Math.max(0, Math.min(7, Math.floor(n)));
}
