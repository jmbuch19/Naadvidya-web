import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin — Naadvidya' };

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/dashboard');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, is_owner')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; role: string; is_owner: boolean }>();

  if (profile?.role !== 'owner_admin') redirect('/');

  // Get counts. RLS allows admin to see everything.
  const [pendingTeachers, totalTeachers, totalStudents, pendingPayouts, pendingOfferings] = await Promise.all([
    supabase.from('teacher_profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    supabase.from('teacher_profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('payouts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('class_offerings').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
  ]);

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teacher/dashboard" className="text-muted-warm hover:text-maroon-mid">Teach</Link>
            <span className="text-muted-warm hidden md:inline">{profile?.full_name}</span>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Owner control room</p>
          <h1 className="font-display text-4xl text-maroon">Naadvidya admin</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <Stat label="Pending teachers" value={pendingTeachers.count ?? 0} accent={(pendingTeachers.count ?? 0) > 0} />
          <Stat label="Pending offerings" value={pendingOfferings.count ?? 0} accent={(pendingOfferings.count ?? 0) > 0} />
          <Stat label="Active teachers" value={totalTeachers.count ?? 0} />
          <Stat label="Students" value={totalStudents.count ?? 0} />
          <Stat label="Pending payouts" value={pendingPayouts.count ?? 0} accent={(pendingPayouts.count ?? 0) > 0} />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <NavCard href="/admin/teachers" title="Teachers" sub="Approve pending teachers, manage faculty" />
          <NavCard href="/admin/offerings" title="Workshops & Programmes" sub="Approve Workshops & Gurukul Paths" />
          <NavCard href="/admin/payouts" title="Payouts" sub="Mark teacher payouts paid" />
          <NavCard href="/admin/bookings" title="Bookings" sub="All sessions, filterable by status" />
          <NavCard href="/admin/students" title="Students" sub="All students, credits, sessions" />
        </div>

        <p className="mt-12 text-xs text-muted-warm">
          Phase 1.5 admin: teacher + offering approval, payouts, audit views. Disputes,
          audit-log filtering, and platform-settings UI come next — for now, raw SQL via
          Supabase covers those edge cases.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border ${accent ? 'border-gold bg-parchment-2' : 'border-line bg-parchment'} p-5`}>
      <p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p>
      <p className={`font-display text-3xl ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

function NavCard({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <Link href={href} className="block p-6 rounded-lg border border-line bg-parchment-2/40 hover:border-maroon-mid transition-colors">
      <h3 className="font-display text-xl text-maroon">{title}</h3>
      <p className="text-sm mt-1 text-muted-warm">{sub}</p>
    </Link>
  );
}
