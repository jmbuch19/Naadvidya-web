import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../(auth)/actions';

export const metadata = { title: 'Dashboard — Naadvidya' };

interface BookingRow {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  teacher: { profile: { full_name: string } };
}

export default async function DashboardPage({ searchParams }: { searchParams: { booked?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_owner')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; role: 'owner_admin' | 'teacher' | 'student'; is_owner: boolean }>();

  if (profile?.role === 'owner_admin') redirect('/admin/dashboard');
  if (profile?.role === 'teacher') redirect('/teacher/dashboard');

  const [{ data: creditsRow }, { data: bookings }] = await Promise.all([
    supabase
      .from('student_credits')
      .select('credits_balance')
      .eq('student_id', user.id)
      .maybeSingle<{ credits_balance: number }>(),
    supabase
      .from('bookings')
      .select(`
        id, scheduled_at, duration_minutes, is_trial, status,
        teacher:teacher_profiles!bookings_teacher_id_fkey(
          profile:profiles!teacher_profiles_profile_id_fkey(full_name)
        )
      `)
      .eq('student_id', user.id)
      .order('scheduled_at', { ascending: true })
      .returns<BookingRow[]>(),
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

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teachers" className="text-muted-warm hover:text-maroon-mid">Teachers</Link>
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

        <div className="flex flex-wrap items-end justify-between mb-10 gap-4">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">Your sadhana</p>
            <h1 className="font-display text-4xl text-maroon">Namaste, {profile?.full_name ?? 'sadhak'}</h1>
          </div>
          <div className="bg-parchment-2 border border-line rounded-lg px-6 py-3 text-right">
            <p className="text-xs text-muted-warm uppercase tracking-widest">Balance</p>
            <p className="font-display text-3xl text-maroon">{balance} <span className="text-sm text-muted-warm">sessions</span></p>
            <Link href="/credits" className="text-xs text-maroon-mid hover:underline">Buy more →</Link>
          </div>
        </div>

        <Section title="Upcoming">
          {upcoming.length === 0 && pending.length === 0 ? (
            <Empty>
              <p>No upcoming sessions yet.</p>
              <Link href="/teachers" className="btn-primary mt-3 inline-flex">Find your guru</Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {[...upcoming, ...pending].map((b) => (
                <BookingRow key={b.id} booking={b} canJoin={b.status === 'confirmed'} />
              ))}
            </ul>
          )}
        </Section>

        {past.length > 0 && (
          <Section title="Past sessions">
            <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
              {past.slice(0, 10).map((b) => (
                <BookingRow key={b.id} booking={b} canJoin={false} muted />
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-12 grid sm:grid-cols-2 gap-4">
          <Link href="/teachers" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Browse teachers</h2>
            <p className="text-sm text-muted-warm">Find a guru and request a session.</p>
          </Link>
          <Link href="/homework" className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
            <h2 className="font-display text-xl text-maroon mb-1">Homework</h2>
            <p className="text-sm text-muted-warm">Assignments to submit · feedback you&rsquo;ve received.</p>
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

function BookingRow({ booking, canJoin, muted }: { booking: BookingRow; canJoin: boolean; muted?: boolean }) {
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

  return (
    <li className={`flex flex-wrap items-center gap-3 px-4 py-3 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex-1 min-w-[200px]">
        <p className="font-medium text-ink">{teacherName}</p>
        <p className="text-sm text-muted-warm">
          {when} · {booking.duration_minutes}min
          {booking.is_trial && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gold/20 text-gold">Trial</span>}
          <span className="ml-2 text-xs text-muted-warm capitalize">· {booking.status}</span>
        </p>
      </div>
      {showJoin && (
        <Link href={`/session/${booking.id}`} className="text-sm px-3 py-1.5 rounded bg-maroon-mid text-parchment hover:bg-maroon">
          Join room
        </Link>
      )}
    </li>
  );
}
