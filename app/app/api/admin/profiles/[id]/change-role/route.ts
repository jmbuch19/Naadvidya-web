import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

// Admin-only role flip. owner_admin can promote a student to teacher (creates a pending
// teacher_profile if absent), or demote a teacher to student (soft-hides the
// teacher_profile so historical bookings/payouts still resolve). owner_admin role itself
// can never be set or removed through this endpoint — that's seed-migration only.

interface BodyShape {
  role: 'teacher' | 'student';
}

interface ProfileRow {
  id: string;
  role: 'owner_admin' | 'teacher' | 'student';
  full_name: string;
  email: string;
}

interface TeacherProfileLite {
  id: string;
  approval_status: 'pending' | 'approved' | 'rejected';
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: BodyShape;
  try {
    body = (await req.json()) as BodyShape;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.role !== 'teacher' && body.role !== 'student') {
    return NextResponse.json({ error: 'role must be teacher or student' }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: target } = await admin
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', params.id)
    .maybeSingle<ProfileRow>();

  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (target.role === 'owner_admin') {
    return NextResponse.json({ error: 'Cannot change role of an owner_admin' }, { status: 400 });
  }
  if (target.role === body.role) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Flip the role
  const { error: updErr } = await admin
    .from('profiles')
    .update({ role: body.role, updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  if (body.role === 'teacher') {
    // Create a pending teacher_profile if one doesn't already exist
    const { data: existing } = await admin
      .from('teacher_profiles')
      .select('id, approval_status')
      .eq('profile_id', target.id)
      .maybeSingle<TeacherProfileLite>();

    if (!existing) {
      const { error: tpErr } = await admin.from('teacher_profiles').insert({
        profile_id: target.id,
        bio: '',
        session_fee_inr: 800,
        approval_status: 'pending',
        is_visible: false,
      });
      if (tpErr) return NextResponse.json({ error: tpErr.message }, { status: 500 });
    }
  } else {
    // Demote teacher → student: hide their faculty profile but keep the row so existing
    // bookings, scheduled_sessions, and payouts still resolve.
    await admin
      .from('teacher_profiles')
      .update({
        is_visible: false,
        approval_status: 'rejected',
        rejection_note: 'Role changed to student by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('profile_id', target.id);
  }

  await logAudit({
    req,
    actorId: user.id,
    actorRole: caller?.role,
    action: 'profile.role_changed',
    entityType: 'profile',
    entityId: target.id,
    oldValue: { role: target.role },
    newValue: { role: body.role },
  });

  return NextResponse.json({ ok: true, role: body.role });
}
