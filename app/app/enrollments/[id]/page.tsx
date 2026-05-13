import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OFFERING_LABELS, type OfferingType } from '@/lib/offerings';
import { WithdrawButton } from '@/components/enrollments/WithdrawButton';
import { logoutAction } from '../../(auth)/actions';

interface PageProps { params: { id: string } }

interface EnrollmentRow {
  id: string; status: string; intent_text: string | null; start_date: string | null; end_date: string | null;
  sessions_total: number | null; sessions_completed: number; credits_reserved: number; decline_reason: string | null;
  student_id: string;
  offering: { title: string; offering_type: OfferingType; description: string | null };
  teacher: { profile: { full_name: string }; slug: string | null };
}
interface SessionRow {
  id: string; scheduled_at: string; duration_minutes: number; session_number: number | null;
  status: 'upcoming' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show_student' | 'no_show_teacher';
}

export const metadata = { title: 'Enrolment — Naadvidya' };

export default async function EnrollmentDetailPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/enrollments/${params.id}`);

  const { data: enr } = await supabase
    .from('enrollments')
    .select(`
      id, status, intent_text, start_date, end_date, sessions_total, sessions_completed, credits_reserved, decline_reason, student_id,
      offering:class_offerings!enrollments_offering_id_fkey(title, offering_type, description),
      teacher:teacher_profiles!enrollments_teacher_id_fkey(slug, profile:profiles!teacher_profiles_profile_id_fkey(full_name))
    `)
    .eq('id', params.id)
    .maybeSingle<EnrollmentRow>();
  if (!enr) notFound();
  if (enr.student_id !== user.id) redirect('/dashboard');

  const { data: sessions } = await supabase
    .from('scheduled_sessions')
    .select('id, scheduled_at, duration_minutes, session_number, status')
    .eq('enrollment_id', enr.id)
    .order('scheduled_at', { ascending: true })
    .returns<SessionRow[]>();
  const all = sessions ?? [];
  const now = Date.now();

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>
        <div className="mt-4 mb-6">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">{OFFERING_LABELS[enr.offering.offering_type].name} · {statusLabel(enr.status)}</p>
          <h1 className="font-display text-3xl text-maroon">{enr.offering.title}</h1>
          <p className="text-muted-warm mt-1">
            with {enr.teacher.slug ? <Link href={`/teachers/${enr.teacher.slug}`} className="text-maroon-mid hover:underline">{enr.teacher.profile.full_name}</Link> : enr.teacher.profile.full_name}
          </p>
        </div>

        {enr.status === 'declined' && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 mb-6">
            Your application wasn&rsquo;t accepted.{enr.decline_reason ? ` Note: ${enr.decline_reason}` : ''} You can apply again from the offering page.
          </div>
        )}
        {enr.status === 'pending' && (
          <div className="rounded-lg border border-gold/40 bg-parchment-2 p-4 text-sm text-ink mb-6">
            Application pending the teacher&rsquo;s review. They&rsquo;ll accept (and then set up your session schedule) or decline.
          </div>
        )}

        {(enr.sessions_total || enr.credits_reserved > 0) && (
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Stat label="Sessions" value={enr.sessions_total ? `${enr.sessions_completed} / ${enr.sessions_total}` : `${enr.sessions_completed} done`} />
            <Stat label="Credits reserved" value={`${enr.credits_reserved}`} />
            {enr.start_date && <Stat label="Term" value={`${fmtDate(enr.start_date)}${enr.end_date ? ` – ${fmtDate(enr.end_date)}` : ''}`} />}
          </div>
        )}

        {enr.intent_text && (
          <section className="mb-6">
            <h2 className="font-display text-lg text-maroon mb-1">Your application note</h2>
            <p className="text-sm text-ink whitespace-pre-line rounded border border-line bg-parchment p-3">{enr.intent_text}</p>
          </section>
        )}

        <section className="mb-8">
          <h2 className="font-display text-xl text-maroon mb-3">Sessions</h2>
          {all.length === 0 ? (
            <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">
              {enr.offering.offering_type === 'gurukul_path' && enr.status === 'active'
                ? 'Your teacher will set up your recurring schedule shortly.'
                : 'No sessions scheduled yet.'}
            </div>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {all.map((s) => {
                const dt = new Date(s.scheduled_at);
                const mins = (dt.getTime() - now) / 60000;
                const showJoin = s.status === 'upcoming' && mins <= 15;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-ink">
                        {s.session_number ? `Session ${s.session_number} · ` : ''}
                        {dt.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                        <span className="text-xs text-muted-warm"> · {s.duration_minutes}min · {s.status.replace('_', ' ')}</span>
                      </p>
                    </div>
                    {showJoin && <Link href={`/session/s/${s.id}`} className="text-sm px-3 py-1.5 rounded bg-maroon-mid text-parchment hover:bg-maroon">Join room</Link>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {['pending', 'active', 'paused'].includes(enr.status) && (
          <div className="mt-8 border-t border-line pt-6">
            <WithdrawButton enrollmentId={enr.id} />
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-parchment p-4"><p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p><p className="font-display text-xl text-maroon">{value}</p></div>;
}
function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function statusLabel(s: string) { return ({ pending: 'Application pending', active: 'Active', paused: 'Paused', withdrawn: 'Withdrawn', completed: 'Completed', declined: 'Declined' } as Record<string, string>)[s] ?? s; }
