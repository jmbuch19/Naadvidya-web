import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Add a holiday date (POST) or remove one (DELETE ?date=YYYY-MM-DD). RLS restricts
// both to the owning teacher.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  let body: { date?: string; reason?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.date || !YMD.test(body.date)) return NextResponse.json({ error: 'date (YYYY-MM-DD) required' }, { status: 400 });

  const { error } = await supabase
    .from('teacher_holidays')
    .upsert({ teacher_id: teacher.id, holiday_date: body.date, reason: body.reason?.trim() || null, affects_students: true }, { onConflict: 'teacher_id,holiday_date' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  const date = new URL(req.url).searchParams.get('date');
  if (!date || !YMD.test(date)) return NextResponse.json({ error: 'date query param required' }, { status: 400 });

  const { error } = await supabase.from('teacher_holidays').delete().eq('teacher_id', teacher.id).eq('holiday_date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
