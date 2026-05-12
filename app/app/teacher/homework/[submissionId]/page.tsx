import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { presignRead, isR2Configured } from '@/lib/r2';
import { FeedbackForm } from '@/components/teacher/FeedbackForm';
import { logoutAction } from '../../../(auth)/actions';

interface PageProps { params: { submissionId: string } }

interface SubmissionRow {
  id: string;
  status: 'draft' | 'submitted' | 'reviewed';
  submitted_at: string;
  reviewed_at: string | null;
  student: { full_name: string };
  assignment: {
    id: string;
    title: string;
    description: string | null;
    deliverables: string[];
    teacher_id: string;
  };
  submission_files: {
    id: string;
    file_type: 'audio' | 'pdf' | 'image' | 'text';
    file_key: string;
    file_name: string;
    label: string | null;
    file_size_kb: number | null;
  }[];
  feedback: {
    feedback_text: string | null;
    feedback_audio_key: string | null;
  }[];
}

export const metadata = { title: 'Review submission — Naadvidya' };

export default async function TeacherReviewPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/teacher/homework/${params.submissionId}`);

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) redirect('/dashboard');

  const { data: submission } = await supabase
    .from('submissions')
    .select(`
      id, status, submitted_at, reviewed_at,
      student:profiles!submissions_student_id_fkey(full_name),
      assignment:assignments!submissions_assignment_id_fkey(id, title, description, deliverables, teacher_id),
      submission_files(id, file_type, file_key, file_name, label, file_size_kb),
      feedback(feedback_text, feedback_audio_key)
    `)
    .eq('id', params.submissionId)
    .maybeSingle<SubmissionRow>();

  if (!submission) notFound();
  if (submission.assignment.teacher_id !== teacher.id) redirect('/teacher/homework');

  // Presign read URLs for each file
  const fileUrlMap: Record<string, string> = {};
  if (isR2Configured()) {
    await Promise.all(
      submission.submission_files.map(async (f) => {
        try { fileUrlMap[f.id] = await presignRead(f.file_key); } catch { /* */ }
      })
    );
  }

  let feedbackAudioUrl: string | null = null;
  if (submission.feedback?.[0]?.feedback_audio_key && isR2Configured()) {
    try { feedbackAudioUrl = await presignRead(submission.feedback[0].feedback_audio_key); } catch { /* */ }
  }

  // Group files by deliverable label
  const grouped: Record<string, typeof submission.submission_files> = {};
  for (const f of submission.submission_files) {
    const key = f.label ?? 'General';
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(f);
  }

  const isReviewed = submission.status === 'reviewed';

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/homework" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/homework" className="text-sm text-muted-warm hover:text-maroon-mid">← Inbox</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Review</p>
          <h1 className="font-display text-3xl text-maroon">{submission.assignment.title}</h1>
          <p className="text-sm text-muted-warm mt-1">
            From {submission.student.full_name} · Submitted{' '}
            {new Date(submission.submitted_at).toLocaleDateString('en-IN', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}
            {isReviewed && ' · Reviewed'}
          </p>
        </div>

        {submission.assignment.description && (
          <div className="bg-parchment-2 border border-line rounded-lg p-4 mb-6 text-sm whitespace-pre-line">
            <p className="text-xs text-gold uppercase tracking-widest mb-1">Your original brief</p>
            {submission.assignment.description}
          </div>
        )}

        <section className="mb-8">
          <h2 className="font-display text-xl text-maroon mb-3">Student submission</h2>
          <div className="space-y-4">
            {Object.entries(grouped).map(([label, files]) => (
              <div key={label} className="rounded-lg border border-line bg-parchment p-4">
                <p className="font-display text-base text-maroon mb-2">{label}</p>
                <ul className="space-y-2">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm uppercase">
                        {f.file_type}
                      </span>
                      <span className="flex-1 truncate">{f.file_name}</span>
                      {f.file_type === 'audio' && fileUrlMap[f.id] && (
                        <audio controls src={fileUrlMap[f.id]} className="h-8" />
                      )}
                      {f.file_type !== 'audio' && fileUrlMap[f.id] && (
                        <a href={fileUrlMap[f.id]} target="_blank" rel="noreferrer" className="text-maroon-mid hover:underline text-xs">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {submission.submission_files.length === 0 && (
              <p className="text-muted-warm text-sm">No files uploaded.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-maroon mb-3">Your feedback</h2>
          {isReviewed ? (
            <div className="rounded-lg border border-line bg-parchment-2 p-5">
              {submission.feedback?.[0]?.feedback_text && (
                <p className="text-ink whitespace-pre-line mb-3">{submission.feedback[0].feedback_text}</p>
              )}
              {feedbackAudioUrl && <audio controls src={feedbackAudioUrl} className="w-full" />}
            </div>
          ) : (
            <FeedbackForm
              submissionId={submission.id}
              r2Configured={isR2Configured()}
            />
          )}
        </section>
      </main>
    </div>
  );
}
