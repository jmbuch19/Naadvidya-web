import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarkPaidButton } from '@/components/admin/MarkPaidButton';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Payouts — Naadvidya' };

interface PayoutRow {
  id: string;
  gross_amount: number;
  platform_cut: number;
  teacher_amount: number;
  is_owner_session: boolean;
  status: 'pending' | 'paid' | 'held';
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  teacher: {
    profile: { full_name: string; email: string };
  };
  booking: { scheduled_at: string | null; is_trial: boolean };
}

export default async function AdminPayoutsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/payouts');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      id, gross_amount, platform_cut, teacher_amount, is_owner_session,
      status, paid_at, payment_reference, created_at,
      teacher:teacher_profiles!payouts_teacher_id_fkey(
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)
      ),
      booking:bookings!payouts_booking_id_fkey(scheduled_at, is_trial)
    `)
    .order('created_at', { ascending: false })
    .returns<PayoutRow[]>();

  const pending = (payouts ?? []).filter((p) => p.status === 'pending');
  const paid = (payouts ?? []).filter((p) => p.status === 'paid');
  const held = (payouts ?? []).filter((p) => p.status === 'held');

  const pendingTotal = pending.reduce((sum, p) => sum + Number(p.teacher_amount), 0);
  const paidThisMonthTotal = paid
    .filter((p) => {
      if (!p.paid_at) return false;
      const d = new Date(p.paid_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, p) => sum + Number(p.teacher_amount), 0);

  // Aggregate by teacher for the pending queue (sum amount, count sessions)
  const pendingByTeacher = new Map<string, { name: string; email: string; count: number; total: number; payoutIds: string[] }>();
  for (const p of pending) {
    const key = `${p.teacher.profile.email}`;
    const existing = pendingByTeacher.get(key) ?? {
      name: p.teacher.profile.full_name,
      email: p.teacher.profile.email,
      count: 0,
      total: 0,
      payoutIds: [],
    };
    existing.count += 1;
    existing.total += Number(p.teacher_amount);
    existing.payoutIds.push(p.id);
    pendingByTeacher.set(key, existing);
  }

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

        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Operations</p>
          <h1 className="font-display text-4xl text-maroon">Payouts</h1>
          <p className="text-muted-warm mt-2">
            Per Teacher Terms §B.2 — pay on the 1st and 15th of every month, minimum ₹500.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Pending records" value={pending.length.toString()} />
          <Stat label="Pending total" value={`₹${Math.round(pendingTotal).toLocaleString('en-IN')}`} accent />
          <Stat label="Paid this month" value={`₹${Math.round(paidThisMonthTotal).toLocaleString('en-IN')}`} />
          <Stat label="Held (disputes)" value={held.length.toString()} accent={held.length > 0} />
        </div>

        <Section title="By teacher · pending" count={pendingByTeacher.size}>
          {pendingByTeacher.size === 0 ? (
            <Empty>No payouts due.</Empty>
          ) : (
            <div className="space-y-3">
              {Array.from(pendingByTeacher.values())
                .sort((a, b) => b.total - a.total)
                .map((agg) => (
                  <div key={agg.email} className="rounded-lg border border-line bg-parchment p-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-medium text-ink">{agg.name}</p>
                      <p className="text-sm text-muted-warm">{agg.email} · {agg.count} session{agg.count === 1 ? '' : 's'}</p>
                    </div>
                    <p className="font-display text-xl text-maroon">
                      ₹{Math.round(agg.total).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section title="All records" count={(payouts ?? []).length}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-warm">
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Teacher</th>
                <th className="py-2 pr-3">Session</th>
                <th className="py-2 pr-3">Gross</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">To teacher</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).slice(0, 200).map((p) => (
                <tr key={p.id} className="border-b border-line/50">
                  <td className="py-2 pr-3 text-ink">{p.teacher.profile.full_name}</td>
                  <td className="py-2 pr-3 text-muted-warm text-xs">
                    {p.booking.scheduled_at
                      ? new Date(p.booking.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '—'}
                    {p.is_owner_session && <span className="ml-1 text-gold">owner</span>}
                  </td>
                  <td className="py-2 pr-3">₹{Math.round(p.gross_amount).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-3 text-muted-warm">₹{Math.round(p.platform_cut).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-3 font-medium">₹{Math.round(p.teacher_amount).toLocaleString('en-IN')}</td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={p.status} />
                    {p.payment_reference && <span className="ml-2 text-xs text-muted-warm">{p.payment_reference}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {p.status === 'pending' && <MarkPaidButton payoutId={p.id} />}
                    {p.status === 'paid' && p.paid_at && (
                      <span className="text-xs text-muted-warm">
                        {new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border ${accent ? 'border-gold bg-parchment-2' : 'border-line bg-parchment'} p-5`}>
      <p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p>
      <p className={`font-display text-2xl ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p>
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

function StatusBadge({ status }: { status: 'pending' | 'paid' | 'held' }) {
  const cfg = {
    pending: { bg: 'bg-gold/20', text: 'text-maroon' },
    paid: { bg: 'bg-parchment-2', text: 'text-muted-warm' },
    held: { bg: 'bg-red-100', text: 'text-red-700' },
  }[status];
  return <span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.text} capitalize`}>{status}</span>;
}
