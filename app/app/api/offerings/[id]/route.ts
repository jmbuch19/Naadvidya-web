import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH: teacher edits an offering's editable fields / toggles is_active.
//        (Editing forces re-approval if it was already approved? — keep it simple:
//         editing core fields of an approved offering sets it back to pending.)
// DELETE: teacher removes an offering (only if it has no active enrollments — checked).

interface Row { id: string; teacher_id: string; approval_status: string }

async function loadOwned(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return { error: NextResponse.json({ error: 'Teachers only' }, { status: 403 }) };
  const { data: row } = await supabase
    .from('class_offerings').select('id, teacher_id, approval_status').eq('id', id).maybeSingle<Row>();
  if (!row) return { error: NextResponse.json({ error: 'Offering not found' }, { status: 404 }) };
  if (row.teacher_id !== teacher.id) return { error: NextResponse.json({ error: 'Not yours' }, { status: 403 }) };
  return { supabase, row };
}

interface PatchBody {
  title?: string;
  description?: string | null;
  specialization?: string | null;
  prerequisites?: string | null;
  curriculumOutline?: string | null;
  maxStudents?: number;
  isActive?: boolean;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadOwned(params.id);
  if ('error' in ctx) return ctx.error;
  const { supabase, row } = ctx;

  let body: PatchBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  let touchesCore = false;
  if (typeof body.title === 'string' && body.title.trim()) { updates.title = body.title.trim(); touchesCore = true; }
  if (body.description !== undefined) { updates.description = body.description?.trim() || null; touchesCore = true; }
  if (body.specialization !== undefined) updates.specialization = body.specialization?.trim() || null;
  if (body.prerequisites !== undefined) updates.prerequisites = body.prerequisites?.trim() || null;
  if (body.curriculumOutline !== undefined) updates.curriculum_outline = body.curriculumOutline?.trim() || null;
  if (typeof body.maxStudents === 'number') updates.max_students = Math.max(1, Math.floor(body.maxStudents));
  if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;

  // Editing core descriptive fields of an already-approved offering sends it back to
  // pending (Amee re-reviews). Toggling is_active alone doesn't.
  if (touchesCore && row.approval_status === 'approved') {
    updates.approval_status = 'pending';
    updates.is_visible = false;
    updates.rejection_note = null;
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true, noop: true });
  const { error } = await supabase.from('class_offerings').update(updates).eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, reReview: !!updates.approval_status });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await loadOwned(params.id);
  if ('error' in ctx) return ctx.error;
  const { supabase, row } = ctx;

  const { count } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('offering_id', row.id)
    .in('status', ['pending', 'active', 'paused']);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'This offering has active or pending enrolments — deactivate it instead of deleting.' }, { status: 409 });
  }

  const { error } = await supabase.from('class_offerings').delete().eq('id', row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
