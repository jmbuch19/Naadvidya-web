import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Homework inbox — Naadvidya' };

interface SubmissionRow {
  id: string;
  status: 'draft' | 'submitted' | 'reviewed';
  submitted_at: string;
  reviewed_at: string | null;
  student: { full_name: string };
  assignment: { title: string };
  submission_files: { id: string }[];
}

export default async function TeacherHomeworkPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/homework');

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) redirect('/dashboard');

  // Query submissions for assignments this teacher created.
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      id, status, submitted_at, reviewed_at,
      student:profiles!submissions_student_id_fkey(full_name),
      assignment:assignments!submissions_assignment_id_fkey!inner(title, teacher_id),
      submission_files(id)
    `)
    .eq('assignment.teacher_id', teacher.id)
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false })
    .returns<SubmissionRow[]>();

  const awaiting = (submissions ?? []).filter((s) => s.status === 'submitted');
  const reviewed = (submissions ?? []).filter((s) => s.status === 'reviewed');

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>

        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Inbox</p>
          <h1 className="font-display text-4xl text-maroon">Homework to review</h1>
        </div>

        <Section title="Awaiting your review" count={awaiting.length}>
          {awaiting.length === 0 ? (
            <Empty>Nothing pending. Your students are caught up.</Empty>
          ) : (
            <List items={awaiting} highlight />
          )}
        </Section>

        {reviewed.length > 0 && (
          <Section title="Reviewed" count={reviewed.length}>
            <List items={reviewed.slice(0, 20)} muted />
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-2xl text-maroon">{title}</h2>
        <span className="text-sm text-muted-warm">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">
      {children}
    </div>
  );
}

function List({ items, highlight, muted }: { items: SubmissionRow[]; highlight?: boolean; muted?: boolean }) {
  return (
    <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
      {items.map((s) => {
        const when = new Date(s.submitted_at).toLocaleDateString('en-IN', {
          weekday: 'short', day: 'numeric', month: 'short',
        });
        return (
          <li key={s.id} className={`flex items-center gap-4 px-4 py-3 ${muted ? 'opacity-70' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink">{s.student.full_name}</p>
              <p className="text-sm text-muted-warm truncate">{s.assignment.title}</p>
              <p className="text-xs text-muted-warm mt-0.5">
                Submitted {when} · {s.submission_files?.length ?? 0} file{(s.submission_files?.length ?? 0) === 1 ? '' : 's'}
              </p>
            </div>
            <Link
              href={`/teacher/homework/${s.id}`}
              className={highlight ? 'btn-primary !py-1.5 !px-3 text-sm shrink-0' : 'btn-ghost !py-1.5 !px-3 text-sm shrink-0'}
            >
              {highlight ? 'Review' : 'View'}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
