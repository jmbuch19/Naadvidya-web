import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ChangeRoleButton } from '@/components/admin/ChangeRoleButton';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Students — Naadvidya' };

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  city: string | null;
  created_at: string;
  credits: { credits_balance: number }[];
  bookings: { id: string }[];
}

export default async function AdminStudentsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/students');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const { data: students } = await supabase
    .from('profiles')
    .select(`
      id, full_name, email, city, created_at,
      credits:student_credits(credits_balance),
      bookings:bookings!bookings_student_id_fkey(id)
    `)
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(500)
    .returns<StudentRow[]>();

  const allStudents = students ?? [];

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
          <h1 className="font-display text-4xl text-maroon">Students</h1>
          <p className="text-muted-warm mt-2">{allStudents.length} total</p>
        </div>

        {allStudents.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">
            No students yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-warm">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">City</th>
                  <th className="py-2 pr-3 text-right">Credits</th>
                  <th className="py-2 pr-3 text-right">Sessions</th>
                  <th className="py-2 pr-3 text-right">Joined</th>
                  <th className="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {allStudents.map((s) => {
                  const balance = s.credits?.[0]?.credits_balance ?? 0;
                  return (
                    <tr key={s.id} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-ink">{s.full_name}</td>
                      <td className="py-2 pr-3 text-muted-warm">{s.email}</td>
                      <td className="py-2 pr-3 text-muted-warm">{s.city ?? '—'}</td>
                      <td className="py-2 pr-3 text-right font-medium">{balance}</td>
                      <td className="py-2 pr-3 text-right text-muted-warm">{s.bookings?.length ?? 0}</td>
                      <td className="py-2 pr-3 text-right text-muted-warm text-xs">
                        {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <ChangeRoleButton profileId={s.id} fullName={s.full_name} currentRole="student" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
