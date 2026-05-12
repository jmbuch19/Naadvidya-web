import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyHomeworkSubmitted } from '@/lib/notifications';

// Student-initiated: ensure a submission row exists for (assignmentId, currentUser).
// On first call: inserts a draft. On subsequent calls: returns the existing one.
// To finalize (mark as 'submitted'), pass action: 'submit'.

interface Body {
  assignmentId: string;
  action?: 'draft' | 'submit';
}

interface AssignmentRow {
  id: string;
  student_id: string;
}

interface SubmissionRow {
  id: string;
  status: 'draft' | 'submitted' | 'reviewed';
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.assignmentId) {
    return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
  }

  // Verify the assignment is for this student
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, student_id')
    .eq('id', body.assignmentId)
    .maybeSingle<AssignmentRow>();
  if (!assignment) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  if (assignment.student_id !== user.id) {
    return NextResponse.json({ error: 'Not your assignment' }, { status: 403 });
  }

  const action = body.action ?? 'draft';

  // Find existing
  const { data: existing } = await supabase
    .from('submissions')
    .select('id, status')
    .eq('assignment_id', body.assignmentId)
    .eq('student_id', user.id)
    .maybeSingle<SubmissionRow>();

  if (existing) {
    if (action === 'submit' && existing.status === 'draft') {
      const { error: updateErr } = await supabase
        .from('submissions')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      // Notify teacher on submit
      void notifyTeacherOfSubmission(existing.id);
    }
    return NextResponse.json({ id: existing.id, status: action === 'submit' ? 'submitted' : existing.status });
  }

  // Create fresh
  const { data: created, error: insertErr } = await supabase
    .from('submissions')
    .insert({
      assignment_id: body.assignmentId,
      student_id: user.id,
      status: action === 'submit' ? 'submitted' : 'draft',
    })
    .select('id')
    .single<{ id: string }>();

  if (insertErr || !created) {
    return NextResponse.json({ error: insertErr?.message ?? 'Insert failed' }, { status: 500 });
  }

  if (action === 'submit') void notifyTeacherOfSubmission(created.id);

  return NextResponse.json({ id: created.id, status: action === 'submit' ? 'submitted' : 'draft' });
}

async function notifyTeacherOfSubmission(submissionId: string) {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin
      .from('submissions')
      .select(`
        submission_files(id),
        student:profiles!submissions_student_id_fkey(full_name),
        assignment:assignments!submissions_assignment_id_fkey(
          title,
          teacher:teacher_profiles!assignments_teacher_id_fkey(
            profile:profiles!teacher_profiles_profile_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in)
          )
        )
      `)
      .eq('id', submissionId)
      .maybeSingle<{
        submission_files: { id: string }[];
        student: { full_name: string };
        assignment: { title: string; teacher: { profile: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean } } };
      }>();
    if (!data?.assignment?.teacher?.profile) return;
    await notifyHomeworkSubmitted({
      teacher: {
        email: data.assignment.teacher.profile.email,
        fullName: data.assignment.teacher.profile.full_name,
        whatsappNumber: data.assignment.teacher.profile.whatsapp_number,
        whatsappOptedIn: data.assignment.teacher.profile.whatsapp_opted_in,
      },
      studentName: data.student.full_name,
      assignmentTitle: data.assignment.title,
      fileCount: data.submission_files?.length ?? 0,
    });
  } catch (e) {
    console.error('[submissions/upsert] notification failed:', e);
  }
}
