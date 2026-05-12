import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BookingActions } from '@/components/teacher/BookingActions';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Teacher dashboard — Naadvidya' };

interface TeacherProfileRow {
  id: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_note: string | null;
  is_visible: boolean;
  session_fee_inr: number;
  slug: string | null;
}

interface BookingRow {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes_to_teacher: string | null;
  student: { full_name: string; email: string };
}

export default async function TeacherDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; role: 'owner_admin' | 'teacher' | 'student' }>();

  if (!profile) redirect('/login');
  if (profile.role !== 'teacher' && profile.role !== 'owner_admin') redirect('/dashboard');

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, approval_status, rejection_note, is_visible, session_fee_inr, slug')
    .eq('profile_id', user.id)
    .maybeSingle<TeacherProfileRow>();

  if (!teacher) {
    return (
      <div className="min-h-screen bg-parchment">
        <Header name={profile.full_name} />
        <main className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="font-display text-3xl text-maroon mb-2">Set up your teacher profile</h1>
          <p className="text-muted-warm">
            You don&rsquo;t have a teacher profile yet. This usually means you registered as a student
            originally. Contact support to convert your account.
          </p>
        </main>
      </div>
    );
  }

  // Fetch all bookings for this teacher, with any linked assignment so we know
  // which completed bookings still need an assignment posted.
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_at, duration_minutes, is_trial, status, notes_to_teacher,
      student:profiles!bookings_student_id_fkey(full_name, email),
      assignments(id)
    `)
    .eq('teacher_id', teacher.id)
    .order('scheduled_at', { ascending: true })
    .returns<(BookingRow & { assignments: { id: string }[] })[]>();

  // Count pending homework reviews
  const { count: pendingReviewCount } = await supabase
    .from('submissions')
    .select('id, assignment:assignments!submissions_assignment_id_fkey!inner(teacher_id)', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .eq('assignment.teacher_id', teacher.id);

  const now = new Date();
  const pending = (bookings ?? []).filter((b) => b.status === 'pending');
  const upcoming = (bookings ?? []).filter(
    (b) => b.status === 'confirmed' && b.scheduled_at && new Date(b.scheduled_at) > now
  );
  const past = (bookings ?? []).filter(
    (b) => b.status === 'completed' || (b.status === 'confirmed' && b.scheduled_at && new Date(b.scheduled_at) <= now)
  );

  return (
    <div className="min-h-screen bg-parchment">
      <Header name={profile.full_name} />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Teacher dashboard</p>
          <h1 className="font-display text-4xl text-maroon">Namaste, {profile.full_name}</h1>
        </div>

        <ApprovalBanner teacher={teacher} />

        <Section title="Pending requests" count={pending.length}>
          {pending.length === 0 ? (
            <Empty>No pending booking requests.</Empty>
          ) : (
            <BookingList
              bookings={pending}
              renderActions={(b) => <BookingActions bookingId={b.id} showConfirm showCancel />}
            />
          )}
        </Section>

        <Section title="Upcoming sessions" count={upcoming.length}>
          {upcoming.length === 0 ? (
            <Empty>No confirmed sessions on the horizon.</Empty>
          ) : (
            <BookingList
              bookings={upcoming}
              renderActions={(b) => <JoinLink bookingId={b.id} scheduledAt={b.scheduled_at} />}
            />
          )}
        </Section>

        <Section title="Past" count={past.length}>
          {past.length === 0 ? (
            <Empty>No past sessions yet.</Empty>
          ) : (
            <BookingList
              bookings={past.slice(0, 10)}
              renderActions={(b) => {
                const hasAssignment = (b as BookingRow & { assignments?: { id: string }[] }).assignments?.length;
                if (hasAssignment) return <span className="text-xs text-muted-warm">Assignment posted</span>;
                if (b.status === 'completed') {
                  return (
                    <Link href={`/teacher/booking/${b.id}/assignment`} className="text-sm px-3 py-1.5 rounded bg-gold/20 text-maroon hover:bg-gold/40">
                      Post assignment
                    </Link>
                  );
                }
                return null;
              }}
            />
          )}
        </Section>

        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          <NavCard
            href="/teacher/profile"
            title="Profile & availability"
            sub="Edit your bio, fee, slots"
          />
          <NavCard
            href="/teacher/homework"
            title="Homework inbox"
            sub={pendingReviewCount && pendingReviewCount > 0 ? `${pendingReviewCount} awaiting review` : 'Review student submissions'}
          />
          <NavCard
            href="/teacher/earnings"
            title="Earnings"
            sub="Pending and paid payouts"
          />
        </div>
      </main>
    </div>
  );
}

function Header({ name }: { name: string }) {
  return (
    <header className="border-b border-line bg-parchment">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-warm hidden md:inline">{name}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}

function ApprovalBanner({ teacher }: { teacher: TeacherProfileRow }) {
  if (teacher.approval_status === 'approved' && teacher.is_visible) {
    return (
      <div className="mb-8 rounded-lg border border-line bg-parchment-2 px-4 py-3 text-sm text-ink">
        <span className="text-gold font-medium">Approved.</span> Your profile is live on the
        Naadvidya teacher grid {teacher.slug ? <> at <code className="text-xs">/teachers/{teacher.slug}</code></> : null}.
      </div>
    );
  }
  if (teacher.approval_status === 'pending') {
    return (
      <div className="mb-8 rounded-lg border border-gold/40 bg-parchment-2 px-4 py-3 text-sm text-ink">
        <span className="text-gold font-medium">Profile pending Amee&rsquo;s approval.</span>{' '}
        Your profile is hidden from the public grid until approved.
      </div>
    );
  }
  if (teacher.approval_status === 'rejected') {
    return (
      <div className="mb-8 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
        <span className="font-medium">Application rejected.</span>
        {teacher.rejection_note ? <> Note: {teacher.rejection_note}</> : null}
      </div>
    );
  }
  return null;
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

function BookingList({
  bookings,
  renderActions,
  muted,
}: {
  bookings: BookingRow[];
  renderActions?: (b: BookingRow) => React.ReactNode;
  muted?: boolean;
}) {
  return (
    <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
      {bookings.map((b) => {
        const when = b.scheduled_at
          ? new Date(b.scheduled_at).toLocaleString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : 'No time set';
        return (
          <li key={b.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${muted ? 'opacity-70' : ''}`}>
            <div className="flex-1 min-w-[200px]">
              <p className="font-medium text-ink">{b.student.full_name}</p>
              <p className="text-sm text-muted-warm">
                {when} · {b.duration_minutes}min
                {b.is_trial && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gold/20 text-gold">Trial</span>}
                {b.status === 'completed' && <span className="ml-2 text-xs text-muted-warm">Completed</span>}
              </p>
            </div>
            {renderActions ? renderActions(b) : null}
          </li>
        );
      })}
    </ul>
  );
}

function JoinLink({ bookingId, scheduledAt }: { bookingId: string; scheduledAt: string | null }) {
  // Show "Join" 15 min before scheduled time.
  if (!scheduledAt) return null;
  const minsUntil = (new Date(scheduledAt).getTime() - Date.now()) / 60000;
  if (minsUntil > 15) {
    return <span className="text-xs text-muted-warm">Opens 15 min before</span>;
  }
  return (
    <Link href={`/session/${bookingId}`} className="text-sm px-3 py-1.5 rounded bg-maroon-mid text-parchment hover:bg-maroon">
      Join room
    </Link>
  );
}

function NavCard({ href, title, sub, disabled }: { href: string; title: string; sub: string; disabled?: boolean }) {
  const cls = `block p-5 rounded-lg border ${
    disabled
      ? 'border-dashed border-line bg-parchment-2/30 cursor-not-allowed'
      : 'border-line bg-parchment-2/40 hover:border-maroon-mid'
  }`;
  const content = (
    <>
      <h3 className={`font-display text-lg ${disabled ? 'text-muted-warm' : 'text-maroon'}`}>{title}</h3>
      <p className={`text-sm mt-1 ${disabled ? 'text-muted-warm/80' : 'text-muted-warm'}`}>{sub}</p>
      {disabled && <p className="text-xs text-muted-warm/60 mt-2">Coming next</p>}
    </>
  );
  return disabled ? <div className={cls}>{content}</div> : <Link href={href} className={cls}>{content}</Link>;
}
