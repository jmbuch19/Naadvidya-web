import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../(auth)/actions';

export const metadata = { title: 'Homework — Naadvidya' };

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  deliverables: string[];
  due_before: string | null;
  created_at: string;
  teacher: { profile: { full_name: string } };
  submissions: { id: string; status: 'draft' | 'submitted' | 'reviewed' }[];
}

export default async function HomeworkInboxPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/homework');

  const { data: assignments } = await supabase
    .from('assignments')
    .select(`
      id, title, description, deliverables, due_before, created_at,
      teacher:teacher_profiles!assignments_teacher_id_fkey(
        profile:profiles!teacher_profiles_profile_id_fkey(full_name)
      ),
      submissions(id, status)
    `)
    .eq('student_id', user.id)
    .order('created_at', { ascending: false })
    .returns<AssignmentRow[]>();

  const now = new Date();
  const pending = (assignments ?? []).filter((a) => !a.submissions?.[0] || a.submissions[0].status === 'draft');
  const submitted = (assignments ?? []).filter((a) => a.submissions?.[0]?.status === 'submitted');
  const reviewed = (assignments ?? []).filter((a) => a.submissions?.[0]?.status === 'reviewed');

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Sadhana</p>
          <h1 className="font-display text-4xl text-maroon">Your homework</h1>
        </div>

        <Section title="To submit">
          {pending.length === 0 ? (
            <Empty>No assignments waiting — practice well.</Empty>
          ) : (
            <ul className="space-y-3">
              {pending.map((a) => (
                <AssignmentCard key={a.id} a={a} now={now} highlight />
              ))}
            </ul>
          )}
        </Section>

        {submitted.length > 0 && (
          <Section title="Awaiting feedback">
            <ul className="space-y-3">
              {submitted.map((a) => (
                <AssignmentCard key={a.id} a={a} now={now} muted />
              ))}
            </ul>
          </Section>
        )}

        {reviewed.length > 0 && (
          <Section title="Reviewed">
            <ul className="space-y-3">
              {reviewed.map((a) => (
                <AssignmentCard key={a.id} a={a} now={now} muted />
              ))}
            </ul>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-maroon mb-3">{title}</h2>
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

function AssignmentCard({ a, now, highlight, muted }: { a: AssignmentRow; now: Date; highlight?: boolean; muted?: boolean }) {
  const due = a.due_before ? new Date(a.due_before) : null;
  const overdue = due && due < now && !a.submissions?.[0];
  return (
    <li className={`rounded-lg border ${
      highlight ? 'border-line bg-parchment' : 'border-line bg-parchment-2/40'
    } ${muted ? 'opacity-80' : ''} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl text-maroon">{a.title}</h3>
          <p className="text-sm text-muted-warm mt-1">
            {a.teacher.profile.full_name}
            {due && (
              <span className={`ml-2 ${overdue ? 'text-red-700' : ''}`}>
                · Due {due.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                {overdue && ' (overdue)'}
              </span>
            )}
          </p>
          {a.description && (
            <p className="text-sm text-ink mt-3 line-clamp-2">{a.description}</p>
          )}
        </div>
        <Link
          href={`/homework/${a.id}`}
          className={highlight ? 'btn-primary !py-2 !px-4 text-sm shrink-0' : 'btn-ghost !py-2 !px-4 text-sm shrink-0'}
        >
          Open
        </Link>
      </div>
    </li>
  );
}
