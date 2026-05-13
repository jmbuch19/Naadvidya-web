import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OFFERING_LABELS, levelRangeLabel, type OfferingType } from '@/lib/offerings';
import { EnrollmentTeacherActions } from '@/components/enrollments/EnrollmentTeacherActions';
import { BulkScheduleForm } from '@/components/enrollments/BulkScheduleForm';
import { logoutAction } from '../../../(auth)/actions';

interface PageProps { params: { id: string } }

interface OfferingRow {
  id: string; teacher_id: string; offering_type: OfferingType; title: string; description: string | null;
  min_level: number; max_level: number; total_sessions: number | null; price_per_session_inr: number;
  max_students: number; approval_status: string; is_visible: boolean; is_active: boolean; start_date: string | null;
}
interface EnrollmentRow {
  id: string; status: string; intent_text: string | null; sessions_total: number | null; sessions_completed: number;
  credits_reserved: number; created_at: string;
  student: { full_name: string; email: string };
  scheduled_sessions: { id: string; status: string }[];
}

export const metadata = { title: 'Offering — Naadvidya' };

export default async function TeacherOfferingDetailPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/teacher/offerings/${params.id}`);

  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) redirect('/dashboard');

  const { data: offering } = await supabase
    .from('class_offerings')
    .select('id, teacher_id, offering_type, title, description, min_level, max_level, total_sessions, price_per_session_inr, max_students, approval_status, is_visible, is_active, start_date')
    .eq('id', params.id)
    .maybeSingle<OfferingRow>();
  if (!offering) notFound();
  if (offering.teacher_id !== teacher.id) redirect('/teacher/offerings');

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, status, intent_text, sessions_total, sessions_completed, credits_reserved, created_at, student:profiles!enrollments_student_id_fkey(full_name, email), scheduled_sessions(id, status)')
    .eq('offering_id', offering.id)
    .order('created_at', { ascending: false })
    .returns<EnrollmentRow[]>();
  const all = enrollments ?? [];
  const pending = all.filter((e) => e.status === 'pending');
  const active = all.filter((e) => e.status === 'active' || e.status === 'paused');
  const ended = all.filter((e) => e.status === 'withdrawn' || e.status === 'completed' || e.status === 'declined');
  const isGurukul = offering.offering_type === 'gurukul_path';

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}><button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button></form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/offerings" className="text-sm text-muted-warm hover:text-maroon-mid">← My offerings</Link>
        <div className="mt-4 mb-6">
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm">{OFFERING_LABELS[offering.offering_type].name}</span>
          <h1 className="font-display text-3xl text-maroon mt-1.5">{offering.title}</h1>
          <p className="text-sm text-muted-warm mt-1">
            {levelRangeLabel(offering.min_level, offering.max_level)}
            {offering.total_sessions ? ` · ${offering.total_sessions} sessions` : ''} · ₹{Math.round(offering.price_per_session_inr)}/session · up to {offering.max_students} student{offering.max_students === 1 ? '' : 's'}
            {' · '}{offering.approval_status === 'approved' && offering.is_visible ? 'live' : offering.approval_status}
          </p>
          {offering.approval_status === 'approved' && offering.is_visible && <p className="text-sm mt-1"><Link href={`/offerings/${offering.id}`} className="text-maroon-mid hover:underline">View public page →</Link></p>}
        </div>

        {isGurukul && (
          <Section title="Applications" count={pending.length}>
            {pending.length === 0 ? <Empty>No pending applications.</Empty> : (
              <div className="space-y-3">
                {pending.map((e) => (
                  <div key={e.id} className="rounded-lg border border-line bg-parchment p-4 flex flex-wrap items-start gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium text-ink">{e.student.full_name}</p>
                      <p className="text-sm text-muted-warm">{e.student.email} · applied {new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      {e.intent_text && <p className="text-sm text-ink mt-2 whitespace-pre-line">{e.intent_text}</p>}
                    </div>
                    <EnrollmentTeacherActions enrollmentId={e.id} studentName={e.student.full_name} />
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title={isGurukul ? 'Active students' : 'Enrolled'} count={active.length}>
          {active.length === 0 ? <Empty>{isGurukul ? 'No active students yet.' : 'No one enrolled yet.'}</Empty> : (
            <div className="space-y-3">
              {active.map((e) => {
                const total = e.sessions_total ?? e.scheduled_sessions?.length ?? 0;
                const upcoming = (e.scheduled_sessions ?? []).filter((s) => s.status === 'upcoming').length;
                return (
                  <div key={e.id} className="rounded-lg border border-line bg-parchment p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-medium text-ink">{e.student.full_name}</p>
                        <p className="text-sm text-muted-warm">{e.student.email} · {total ? `${e.sessions_completed}/${total} sessions` : 'no sessions yet'} · {upcoming} upcoming · {e.credits_reserved} credits reserved</p>
                      </div>
                    </div>
                    {isGurukul && <BulkScheduleForm enrollmentId={e.id} />}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {ended.length > 0 && (
          <Section title="Past / withdrawn" count={ended.length}>
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {ended.map((e) => (
                <li key={e.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
                  <span className="text-ink">{e.student.full_name}</span>
                  <span className="text-xs text-muted-warm capitalize">{e.status}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="mb-8"><div className="flex items-baseline justify-between mb-3"><h2 className="font-display text-2xl text-maroon">{title}</h2><span className="text-sm text-muted-warm">{count}</span></div>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">{children}</div>;
}
