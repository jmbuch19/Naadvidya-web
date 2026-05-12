import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { presignRead, isR2Configured } from '@/lib/r2';
import { SubmissionWorkspace } from '@/components/homework/SubmissionWorkspace';
import { logoutAction } from '../../(auth)/actions';

interface PageProps { params: { assignmentId: string } }

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  deliverables: string[];
  due_before: string | null;
  student_id: string;
  teacher: { profile: { full_name: string } };
}

interface ExistingSubmission {
  id: string;
  status: 'draft' | 'submitted' | 'reviewed';
  submission_files: {
    id: string;
    file_type: 'audio' | 'pdf' | 'image' | 'text';
    file_key: string;
    file_name: string;
    file_size_kb: number | null;
    label: string | null;
  }[];
  feedback: {
    feedback_text: string | null;
    feedback_audio_key: string | null;
    created_at: string;
  }[];
}

export const metadata = { title: 'Submit homework — Naadvidya' };

export default async function SubmissionPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/homework/${params.assignmentId}`);

  const { data: assignment } = await supabase
    .from('assignments')
    .select(`
      id, title, description, deliverables, due_before, student_id,
      teacher:teacher_profiles!assignments_teacher_id_fkey(
        profile:profiles!teacher_profiles_profile_id_fkey(full_name)
      )
    `)
    .eq('id', params.assignmentId)
    .maybeSingle<AssignmentRow>();

  if (!assignment) notFound();
  if (assignment.student_id !== user.id) redirect('/dashboard');

  const { data: submission } = await supabase
    .from('submissions')
    .select(`
      id, status,
      submission_files(id, file_type, file_key, file_name, file_size_kb, label),
      feedback(feedback_text, feedback_audio_key, created_at)
    `)
    .eq('assignment_id', assignment.id)
    .eq('student_id', user.id)
    .maybeSingle<ExistingSubmission>();

  // Presign read URLs for any existing files (so the student can re-listen to what they uploaded)
  const fileUrlMap: Record<string, string> = {};
  if (submission?.submission_files?.length && isR2Configured()) {
    await Promise.all(
      submission.submission_files.map(async (f) => {
        try {
          fileUrlMap[f.id] = await presignRead(f.file_key);
        } catch {
          /* ignore */
        }
      })
    );
  }

  let feedbackAudioUrl: string | null = null;
  if (submission?.feedback?.[0]?.feedback_audio_key && isR2Configured()) {
    try {
      feedbackAudioUrl = await presignRead(submission.feedback[0].feedback_audio_key);
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/homework" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/homework" className="text-sm text-muted-warm hover:text-maroon-mid">← All homework</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Assignment</p>
          <h1 className="font-display text-3xl text-maroon">{assignment.title}</h1>
          <p className="text-sm text-muted-warm mt-1">From {assignment.teacher.profile.full_name}</p>
          {assignment.due_before && (
            <p className="text-sm text-muted-warm">
              Due {new Date(assignment.due_before).toLocaleString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </p>
          )}
        </div>

        {assignment.description && (
          <div className="bg-parchment-2 border border-line rounded-lg p-5 mb-6 whitespace-pre-line">
            {assignment.description}
          </div>
        )}

        {submission?.status === 'reviewed' && submission.feedback?.[0] && (
          <div className="rounded-lg border border-gold/40 bg-parchment-2 p-5 mb-6">
            <p className="text-xs text-gold uppercase tracking-widest mb-2">
              Feedback from {assignment.teacher.profile.full_name}
            </p>
            {submission.feedback[0].feedback_text && (
              <p className="text-ink whitespace-pre-line mb-3">{submission.feedback[0].feedback_text}</p>
            )}
            {feedbackAudioUrl && (
              <audio controls src={feedbackAudioUrl} className="w-full" />
            )}
          </div>
        )}

        {submission?.status === 'submitted' && (
          <div className="rounded-lg border border-line bg-parchment-2 p-4 mb-6 text-sm">
            ✓ Submitted. Waiting for your guru&rsquo;s feedback.
          </div>
        )}

        <SubmissionWorkspace
          assignmentId={assignment.id}
          deliverables={assignment.deliverables}
          submissionId={submission?.id ?? null}
          status={submission?.status ?? null}
          existingFiles={(submission?.submission_files ?? []).map((f) => ({
            id: f.id,
            label: f.label,
            fileName: f.file_name,
            fileType: f.file_type,
            url: fileUrlMap[f.id] ?? null,
          }))}
          r2Configured={isR2Configured()}
        />
      </main>
    </div>
  );
}
