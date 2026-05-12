import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Bookings — Naadvidya' };

interface BookingRow {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  created_at: string;
  student: { full_name: string };
  teacher: { profile: { full_name: string } };
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/bookings');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const status = searchParams.status;
  let query = supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, is_trial, created_at,
      student:profiles!bookings_student_id_fkey(full_name),
      teacher:teacher_profiles!bookings_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name))
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status && ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
    query = query.eq('status', status);
  }

  const { data: bookings } = await query.returns<BookingRow[]>();

  const allBookings = bookings ?? [];

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/admin/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Admin</Link>
        <div className="mt-4 mb-6">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Audit</p>
          <h1 className="font-display text-4xl text-maroon">Bookings</h1>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { v: undefined, label: 'All' },
            { v: 'pending', label: 'Pending' },
            { v: 'confirmed', label: 'Confirmed' },
            { v: 'completed', label: 'Completed' },
            { v: 'cancelled', label: 'Cancelled' },
            { v: 'no_show', label: 'No-show' },
          ].map((f) => {
            const active = status === f.v || (!status && !f.v);
            const href = f.v ? `/admin/bookings?status=${f.v}` : '/admin/bookings';
            return (
              <Link
                key={f.label}
                href={href}
                className={`text-xs px-3 py-1.5 rounded-full border ${
                  active
                    ? 'bg-maroon-mid text-parchment border-maroon-mid'
                    : 'bg-parchment border-line text-muted-warm hover:border-maroon-mid'
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {allBookings.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">
            No bookings match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-warm">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Teacher</th>
                  <th className="py-2 pr-3">Scheduled</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {allBookings.map((b) => (
                  <tr key={b.id} className="border-b border-line/50">
                    <td className="py-2 pr-3 text-ink">{b.student.full_name}</td>
                    <td className="py-2 pr-3 text-ink">{b.teacher.profile.full_name}</td>
                    <td className="py-2 pr-3 text-muted-warm">
                      {b.scheduled_at
                        ? new Date(b.scheduled_at).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
                          })
                        : '—'}
                      {b.is_trial && <span className="ml-2 text-xs text-gold">Trial</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        b.status === 'completed' ? 'bg-parchment-2 text-muted-warm'
                        : b.status === 'confirmed' ? 'bg-gold/20 text-maroon'
                        : b.status === 'pending' ? 'bg-orange-100 text-orange-900'
                        : b.status === 'cancelled' ? 'bg-red-100 text-red-700'
                        : 'bg-parchment-2 text-muted-warm'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-warm text-xs text-right">
                      {new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
