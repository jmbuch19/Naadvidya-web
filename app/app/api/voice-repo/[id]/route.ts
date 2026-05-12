import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deleteObject } from '@/lib/r2';

// PATCH: update a voice_repo recording's metadata / toggle public sample / active.
// DELETE: remove the recording (and its R2 objects).
// RLS restricts both to the owning teacher (or admin).

interface PatchBody {
  title?: string;
  description?: string | null;
  raga?: string | null;
  taal?: string | null;
  notesText?: string | null;
  collectionId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  makePublicSample?: boolean;     // true → set as the public sample; false → unset
}

interface Row {
  id: string;
  teacher_id: string;
  file_key: string;
  notes_pdf_key: string | null;
}

async function loadOwned(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return { error: NextResponse.json({ error: 'Teachers only' }, { status: 403 }) };

  const { data: row } = await supabase
    .from('voice_repo').select('id, teacher_id, file_key, notes_pdf_key').eq('id', id).maybeSingle<Row>();
  if (!row) return { error: NextResponse.json({ error: 'Recording not found' }, { status: 404 }) };
  if (row.teacher_id !== teacher.id) return { error: NextResponse.json({ error: 'Not yours' }, { status: 403 }) };

  return { supabase, teacher, row };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadOwned(params.id);
  if ('error' in ctx) return ctx.error;
  const { supabase, teacher, row } = ctx;

  let body: PatchBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.raga !== undefined) updates.raga = body.raga?.trim() || null;
  if (body.taal !== undefined) updates.taal = body.taal?.trim() || null;
  if (body.notesText !== undefined) updates.notes_text = body.notesText?.trim() || null;
  if (body.collectionId !== undefined) updates.collection_id = body.collectionId || null;
  if (typeof body.sortOrder === 'number') updates.sort_order = Math.floor(body.sortOrder);
  if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;

  // Public-sample toggle needs care: only one per teacher.
  if (body.makePublicSample === true) {
    await supabase.from('voice_repo').update({ is_public_sample: false })
      .eq('teacher_id', teacher.id).eq('is_public_sample', true).neq('id', row.id);
    updates.is_public_sample = true;
  } else if (body.makePublicSample === false) {
    updates.is_public_sample = false;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true, noop: true });

  const { error } = await supabase.from('voice_repo').update(updates).eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadOwned(params.id);
  if ('error' in ctx) return ctx.error;
  const { supabase, row } = ctx;

  const { error } = await supabase.from('voice_repo').delete().eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort R2 cleanup
  try {
    await deleteObject(row.file_key);
    if (row.notes_pdf_key) await deleteObject(row.notes_pdf_key);
  } catch (e) {
    console.warn('[voice-repo/delete] R2 cleanup failed:', e);
  }

  return NextResponse.json({ ok: true });
}
