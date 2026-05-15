import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RescheduleControls } from '@/components/reschedule/RescheduleControls';
import { logoutAction } from '../(auth)/actions';

export const metadata = { title: 'Dashboard — Naadvidya' };

interface BookingRow {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  reschedule_count: number;
  reschedule_proposed_by: string | null;
  reschedule_proposed_new_at: string | null;
  reschedule_proposal_reason: string | null;
  teacher: { profile: { full_name: string } };
}

interface EnrollmentRow {
  id: string;
  status: 'pending' | 'active' | 'paused' | 'withdrawn' | 'completed' | 'declined';
  sessions_total: number | null;
  sessions_completed: number;
  offering: { title: string; offering_type: string };
  teacher: { profile: { full_name: string } };
}

interface ScheduledRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  session_number: number | null;
  status: string;
  reschedule_count: number;
  reschedule_proposed_by: string | null;
  reschedule_proposed_new_at: string | null;
  reschedule_proposal_reason: string | null;
  teacher: { profile: { full_name: string } };
  enrollment: { offering: { title: string } } | null;
}

export default async function DashboardPage({ searchParams }: { searchParams: { booked?: string; enrolled?: string; applied?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_owner')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; role: 'owner_admin' | 'teacher' | 'student'; is_owner: boolean }>();

  // If profile is missing, the session is referring to a user without a row in
  // our app schema (cleanup race, deleted profile, RLS regression). Force a
  // re-auth rather than rendering the student dashboard with a generic fallback.
  if (!profile) redirect('/login?error=Your+session+is+incomplete.+Sign+in+again.');

  if (profile.role === 'owner_admin') redirect('/admin/dashboard');
  if (profile.role === 'teacher') redirect('/teacher/dashboard');

  const [{ data: creditsRow }, { data: bookings }, { data: enrollments }, { data: scheduled }] = await Promise.all([
    supabase
      .from('student_credits')
      .select('credits_balance')
      .eq('student_id', user.id)
      .maybeSingle<{ credits_balance: number }>(),
    supabase
      .from('bookings')
      .select(`
        id, scheduled_at, duration_minutes, is_trial, status,
        reschedule_count, reschedule_proposed_by, reschedule_proposed_new_at, reschedule_proposal_reason,
        teacher:teacher_profiles!bookings_teacher_id_fkey(
          profile:profiles!teacher_profiles_profile_id_fkey(full_name)
        )
      `)
      .eq('student_id', user.id)
      .order('scheduled_at', { ascending: true })
      .returns<BookingRow[]>(),
    supabase
      .from('enrollments')
      .select(`
        id, status, sessions_total, sessions_completed,
        offering:class_offerings!enrollments_offering_id_fkey(title, offering_type),
        teacher:teacher_profiles!enrollments_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name))
      `)
      .eq('student_id', user.id)
      .in('status', ['pending', 'active', 'paused', 'completed'])
      .order('created_at', { ascending: false })
      .returns<EnrollmentRow[]>(),
    supabase
      .from('scheduled_sessions')
      .select(`
        id, scheduled_at, duration_minutes, session_number, status,
        reschedule_count, reschedule_proposed_by, reschedule_proposed_new_at, reschedule_proposal_reason,
        teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name)),
        enrollment:enrollments!scheduled_sessions_enrollment_id_fkey(offering:class_offerings!enrollments_offering_id_fkey(title))
      `)
      .eq('student_id', user.id)
      .eq('status', 'upcoming')
      .order('scheduled_at', { ascending: true })
      .limit(10)
      .returns<ScheduledRow[]>(),
  ]);

  const balance = creditsRow?.credits_balance ?? 0;
  const now = new Date();
  const pending = (bookings ?? []).filter((b) => b.status === 'pending');
  const upcoming = (bookings ?? []).filter(
    (b) => b.status === 'confirmed' && b.scheduled_at && new Date(b.scheduled_at) > now
  );
  const past = (bookings ?? []).filter(
    (b) => b.status === 'completed' || (b.status === 'confirmed' && b.scheduled_at && new Date(b.scheduled_at) <= now)
  );
  const activeEnrolments = (enrollments ?? []).filter((e) => e.status !== 'completed');
  const scheduledSessions = (scheduled ?? []);

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teachers" className="text-muted-warm hover:text-maroon-mid">Teachers</Link>
            <Link href="/offerings" className="text-muted-warm hover:text-maroon-mid">Programmes</Link>
            <Link href="/credits" className="text-muted-warm hover:text-maroon-mid">Credits</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {searchParams.booked && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 px-4 py-3 text-sm text-ink">
            ✓ Booking request sent. You&rsquo;ll see it confirmed once your guru accepts.
          </div>
        )}
        {searchParams.enrolled && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 px-4 py-3 text-sm text-ink">
            ✓ Enrolled. Your workshop sessions are below — credits have been reserved, one per session.
          </div>
        )}
        {searchParams.applied && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 px-4 py-3 text-sm text-ink">
            ✓ Application sent. The teacher will accept (and then schedule your sessions) or decline.
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between mb-10 gap-4">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">Your sadhana</p>
            <h1 className="font-display text-4xl text-maroon">Namaste, {profile.full_name}</h1>
          </div>
          <div className="bg-parchment-2 border border-line rounded-lg px-6 py-3 text-right">
            <p className="text-xs text-muted-warm uppercase tracking-widest">Balance</p>
            <p className="font-display text-3xl text-maroon">{balance} <span className="text-sm text-muted-warm">sessions</span></p>
            <Link href="/credits" className="text-xs text-maroon-mid hover:underline">Buy more →</Link>
          </div>
        </div>

        <Section title="Upcoming sessions">
          {upcoming.length === 0 && pending.length === 0 && scheduledSessions.length === 0 ? (
            <Empty>
              <p>No upcoming sessions yet.</p>
              <div className="mt-3 flex flex-wrap gap-3 justify-center">
                <Link href="/teachers" className="btn-primary">Find a guru</Link>
                <Link href="/offerings" className="btn-ghost">Browse workshops</Link>
              </div>
            </Empty>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {scheduledSessions.map((s) => <ScheduledSessionRow key={s.id} s={s} callerId={user.id} />)}
              {[...upcoming, ...pending].map((b) => (
                <BookingRow key={b.id} booking={b} canJoin={b.status === 'confirmed'} callerId={user.id} />
              ))}
            </ul>
          )}
        </Section>

        {activeEnrolments.length > 0 && (
          <Section title="Workshops & programmes">
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {activeEnrolments.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-medium text-ink">{e.offering.title}</p>
                    <p className="text-sm text-muted-warm">
                      {e.teacher.profile.full_name}
                      {' · '}{e.status === 'pending' ? 'application pending' : e.sessions_total ? `${e.sessions_completed}/${e.sessions_total} sessions` : 'awaiting schedule'}
                    </p>
                  </div>
                  <Link href={`/enrollments/${e.id}`} className="text-sm text-maroon-mid hover:underline">Open →</Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {past.length > 0 && (
          <Section title="Past sessions">
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {past.slice(0, 10).map((b) => (
                <BookingRow key={b.id} booking={b} canJoin={false} muted callerId={user.id} />
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/teachers" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Browse teachers</h2>
            <p className="text-sm text-muted-warm">Find a guru and request a session.</p>
          </Link>
          <Link href="/offerings" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Workshops & programmes</h2>
            <p className="text-sm text-muted-warm">Riyaaz Workshops · Gurukul Paths.</p>
          </Link>
          <Link href="/homework" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Homework</h2>
            <p className="text-sm text-muted-warm">Assignments to submit · feedback received.</p>
          </Link>
          <Link href="/practice" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Practice tools</h2>
            <p className="text-sm text-muted-warm">Tanpura drone &amp; taal-aware timer.</p>
          </Link>
        </div>
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
    <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm">
      {children}
    </div>
  );
}

function ScheduledSessionRow({ s, callerId }: { s: ScheduledRow; callerId: string }) {
  const dt = new Date(s.scheduled_at);
  const mins = (dt.getTime() - Date.now()) / 60000;
  const showJoin = mins <= 15;
  const label = s.enrollment?.offering?.title ?? 'Session';
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-[200px]">
        <p className="font-medium text-ink">{s.teacher.profile.full_name}</p>
        <p className="text-sm text-muted-warm">
          {dt.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} · {s.duration_minutes}min
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm">{label}{s.session_number ? ` · #${s.session_number}` : ''}</span>
        </p>
        <div className="mt-2">
          <RescheduleControls
            kind="session"
            id={s.id}
            currentScheduledAt={s.scheduled_at}
            rescheduleCount={s.reschedule_count ?? 0}
            proposedNewAt={s.reschedule_proposed_new_at}
            proposalReason={s.reschedule_proposal_reason}
            isProposer={s.reschedule_proposed_by === callerId}
          />
        </div>
      </div>
      {showJoin && <Link href={`/session/s/${s.id}`} className="text-sm px-3 py-1.5 rounded bg-maroon-mid text-parchment hover:bg-maroon">Join room</Link>}
    </li>
  );
}

function BookingRow({ booking, canJoin, muted, callerId }: { booking: BookingRow; canJoin: boolean; muted?: boolean; callerId: string }) {
  const teacherName = booking.teacher?.profile?.full_name ?? 'Teacher';
  const when = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time TBD';
  const minsUntil = booking.scheduled_at
    ? (new Date(booking.scheduled_at).getTime() - Date.now()) / 60000
    : null;
  const showJoin = canJoin && minsUntil !== null && minsUntil <= 15;
  const showReschedule = booking.status === 'confirmed' && booking.scheduled_at && !muted;

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex-1 min-w-[200px]">
        <p className="font-medium text-ink">{teacherName}</p>
        <p className="text-sm text-muted-warm">
          {when} · {booking.duration_minutes}min
          {booking.is_trial && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gold/20 text-gold">Trial</span>}
          <span className="ml-2 text-xs text-muted-warm capitalize">· {booking.status}</span>
        </p>
        {showReschedule && (
          <div className="mt-2">
            <RescheduleControls
              kind="booking"
              id={booking.id}
              currentScheduledAt={booking.scheduled_at!}
              rescheduleCount={booking.reschedule_count ?? 0}
              proposedNewAt={booking.reschedule_proposed_new_at}
              proposalReason={booking.reschedule_proposal_reason}
              isProposer={booking.reschedule_proposed_by === callerId}
            />
          </div>
        )}
      </div>
      {showJoin && (
        <Link href={`/session/${booking.id}`} className="text-sm px-3 py-1.5 rounded bg-maroon-mid text-parchment hover:bg-maroon">
          Join room
        </Link>
      )}
    </li>
  );
}
