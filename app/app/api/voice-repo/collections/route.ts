import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Create a collection (e.g. "Yaman Series") for grouping the teacher's recordings.

interface Body {
  title: string;
  description?: string | null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const { data, error } = await supabase
    .from('voice_repo_collections')
    .insert({ teacher_id: teacher.id, title: body.title.trim(), description: body.description?.trim() || null })
    .select('id, title')
    .single<{ id: string; title: string }>();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  return NextResponse.json(data);
}
