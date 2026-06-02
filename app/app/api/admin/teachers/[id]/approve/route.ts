import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { notifyTeacherApproved } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

// Admin atomically: sets approval_status='approved', is_visible=true, slug,
// approved_by, approved_at. CRITICAL RULE (CLAUDE_CODE_PROMPT §CRITICAL RULES.6):
// approval_status='approved' AND is_visible=true must be set atomically — never
// approved-but-hidden.

interface TeacherRow {
  id: string;
  profile_id: string;
  slug: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  profile: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Verify caller is owner_admin
  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const admin = createServiceRoleClient();

  const { data: teacher } = await admin
    .from('teacher_profiles')
    .select('id, profile_id, slug, approval_status, profile:profiles!teacher_profiles_profile_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in)')
    .eq('id', params.id)
    .maybeSingle<TeacherRow>();

  if (!teacher) return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });

  // Generate slug if not set
  let slug = teacher.slug;
  if (!slug) {
    slug = await uniqueSlug(toSlug(teacher.profile.full_name), async (candidate) => {
      const { data } = await admin
        .from('teacher_profiles')
        .select('id')
        .eq('slug', candidate)
        .maybeSingle();
      return !!data;
    });
  }

  const { error } = await admin
    .from('teacher_profiles')
    .update({
      approval_status: 'approved',
      is_visible: true,
      rejection_note: null,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      slug,
    })
    .eq('id', teacher.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    req,
    actorId: user.id,
    actorRole: caller?.role,
    action: 'teacher.approved',
    entityType: 'teacher_profile',
    entityId: teacher.id,
    oldValue: { approval_status: teacher.approval_status },
    newValue: { approval_status: 'approved', is_visible: true, slug },
  });

  // Notify teacher (best-effort).
  try {
    await notifyTeacherApproved({
      teacher: {
        email: teacher.profile.email,
        fullName: teacher.profile.full_name,
        whatsappNumber: teacher.profile.whatsapp_number,
        whatsappOptedIn: teacher.profile.whatsapp_opted_in,
      },
    });
  } catch (e) {
    console.error('[admin/approve] notification failed:', e);
  }

  return NextResponse.json({ id: teacher.id, slug });
}
