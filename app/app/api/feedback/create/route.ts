import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyFeedbackReceived } from '@/lib/notifications';

// Teacher posts feedback on a submission. Either text, audio (R2 key), or both.
// Side effects:
//   - submissions.status → 'reviewed', reviewed_at set
//   - feedback row inserted

interface Body {
  submissionId: string;
  feedbackText?: string | null;
  feedbackAudioKey?: string | null;     // R2 key from a prior /api/upload/finalize (kind='feedback')
}

interface SubmissionRow {
  id: string;
  status: string;
  assignment: { teacher_id: string };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.submissionId) {
    return NextResponse.json({ error: 'submissionId required' }, { status: 400 });
  }
  if (!body.feedbackText && !body.feedbackAudioKey) {
    return NextResponse.json({ error: 'Feedback must include text or audio' }, { status: 400 });
  }

  // Resolve teacher_id and verify they own the assignment
  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Only teachers can post feedback' }, { status: 403 });

  const { data: submission } = await supabase
    .from('submissions')
    .select('id, status, assignment:assignments!submissions_assignment_id_fkey(teacher_id)')
    .eq('id', body.submissionId)
    .maybeSingle<SubmissionRow>();
  if (!submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  if (submission.assignment?.teacher_id !== teacher.id) {
    return NextResponse.json({ error: 'Not your assignment' }, { status: 403 });
  }

  // Insert feedback (UNIQUE constraint on submission_id prevents dupes — caller should update instead)
  const { error: feedbackErr } = await supabase
    .from('feedback')
    .insert({
      submission_id: submission.id,
      teacher_id: teacher.id,
      feedback_text: body.feedbackText?.trim() || null,
      feedback_audio_url: body.feedbackAudioKey ?? null,
      feedback_audio_key: body.feedbackAudioKey ?? null,
    });

  if (feedbackErr) {
    return NextResponse.json({ error: feedbackErr.message }, { status: 500 });
  }

  // Mark submission reviewed
  const admin = createServiceRoleClient();
  await admin
    .from('submissions')
    .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
    .eq('id', submission.id);

  // Notify student (best-effort).
  try {
    const { data: detail } = await admin
      .from('submissions')
      .select(`
        student:profiles!submissions_student_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in),
        assignment:assignments!submissions_assignment_id_fkey(
          title,
          teacher:teacher_profiles!assignments_teacher_id_fkey(
            profile:profiles!teacher_profiles_profile_id_fkey(full_name)
          )
        )
      `)
      .eq('id', submission.id)
      .maybeSingle<{
        student: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean };
        assignment: { title: string; teacher: { profile: { full_name: string } } };
      }>();
    if (detail?.student && detail.assignment?.teacher?.profile) {
      await notifyFeedbackReceived({
        student: {
          email: detail.student.email,
          fullName: detail.student.full_name,
          whatsappNumber: detail.student.whatsapp_number,
          whatsappOptedIn: detail.student.whatsapp_opted_in,
        },
        teacherName: detail.assignment.teacher.profile.full_name,
        assignmentTitle: detail.assignment.title,
      });
    }
  } catch (e) {
    console.error('[feedback/create] notification failed:', e);
  }

  return NextResponse.json({ ok: true });
}
