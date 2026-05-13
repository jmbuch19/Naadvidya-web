import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { MarkPaidButton } from '@/components/admin/MarkPaidButton';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Payouts — Naadvidya' };

interface PayoutDetails { payout_method: 'upi' | 'bank' | null; upi_id: string | null; bank_account_name: string | null; bank_account_number: string | null; bank_ifsc: string | null }
interface PayoutRow {
  id: string;
  gross_amount: number; platform_cut: number; teacher_amount: number; is_owner_session: boolean;
  status: 'pending' | 'paid' | 'held';
  paid_at: string | null; payment_reference: string | null; created_at: string;
  teacher: { id: string; profile: { full_name: string; email: string }; payout_details: PayoutDetails | PayoutDetails[] | null };
  booking: { scheduled_at: string | null; is_trial: boolean } | null;
  scheduled_session: { scheduled_at: string | null; enrollment: { offering: { title: string } } | null } | null;
}

function detailsOf(p: PayoutRow): PayoutDetails | null {
  const d = p.teacher.payout_details;
  if (!d) return null;
  return Array.isArray(d) ? (d[0] ?? null) : d;
}
function describePayout(d: PayoutDetails | null): string {
  if (!d?.payout_method) return 'no payout details';
  if (d.payout_method === 'upi') return `UPI: ${d.upi_id}`;
  return `Bank: ${d.bank_account_name} · A/c ${d.bank_account_number} · ${d.bank_ifsc}`;
}
function payoutDate(p: PayoutRow): string | null {
  return p.booking?.scheduled_at ?? p.scheduled_session?.scheduled_at ?? null;
}
function payoutSource(p: PayoutRow): string {
  if (p.booking) return p.booking.is_trial ? 'Mehfil (trial)' : 'Mehfil';
  return p.scheduled_session?.enrollment?.offering?.title ?? 'Class';
}

export default async function AdminPayoutsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/payouts');
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      id, gross_amount, platform_cut, teacher_amount, is_owner_session,
      status, paid_at, payment_reference, created_at,
      teacher:teacher_profiles!payouts_teacher_id_fkey(
        id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name, email),
        payout_details:teacher_payout_details(payout_method, upi_id, bank_account_name, bank_account_number, bank_ifsc)
      ),
      booking:bookings!payouts_booking_id_fkey(scheduled_at, is_trial),
      scheduled_session:scheduled_sessions!payouts_scheduled_session_id_fkey(scheduled_at, enrollment:enrollments!scheduled_sessions_enrollment_id_fkey(offering:class_offerings!enrollments_offering_id_fkey(title)))
    `)
    .order('created_at', { ascending: false })
    .returns<PayoutRow[]>();

  const all = payouts ?? [];
  const pending = all.filter((p) => p.status === 'pending');
  const paid = all.filter((p) => p.status === 'paid');
  const held = all.filter((p) => p.status === 'held');
  const sum = (arr: PayoutRow[]) => arr.reduce((s, p) => s + Number(p.teacher_amount), 0);
  const pendingTotal = sum(pending);
  const now = new Date();
  const paidThisMonthTotal = sum(paid.filter((p) => p.paid_at && new Date(p.paid_at).getFullYear() === now.getFullYear() && new Date(p.paid_at).getMonth() === now.getMonth()));

  // Aggregate pending by teacher (sum, count, payout details)
  const byTeacher = new Map<string, { name: string; email: string; count: number; total: number; details: PayoutDetails | null }>();
  for (const p of pending) {
    const key = p.teacher.id;
    const ex = byTeacher.get(key) ?? { name: p.teacher.profile.full_name, email: p.teacher.profile.email, count: 0, total: 0, details: detailsOf(p) };
    ex.count += 1; ex.total += Number(p.teacher_amount);
    byTeacher.set(key, ex);
  }
  const belowThreshold = (total: number) => total < 500;

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}><button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button></form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/admin/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Admin</Link>
        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Operations</p>
          <h1 className="font-display text-4xl text-maroon">Payouts</h1>
          <p className="text-muted-warm mt-2 text-sm">
            Manual model — pay on the 1st and 15th of every month. Minimum ₹500; balances below that roll
            over to the next cycle. After you transfer, hit &ldquo;Mark paid&rdquo; and enter the reference.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Pending records" value={pending.length.toString()} />
          <Stat label="Pending total" value={`₹${Math.round(pendingTotal).toLocaleString('en-IN')}`} accent />
          <Stat label="Paid this month" value={`₹${Math.round(paidThisMonthTotal).toLocaleString('en-IN')}`} />
          <Stat label="Held (disputes)" value={held.length.toString()} accent={held.length > 0} />
        </div>

        <Section title="By teacher · pending" count={byTeacher.size}>
          {byTeacher.size === 0 ? <Empty>No payouts due.</Empty> : (
            <div className="space-y-3">
              {Array.from(byTeacher.values()).sort((a, b) => b.total - a.total).map((agg) => (
                <div key={agg.email} className="rounded-lg border border-line bg-parchment p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-medium text-ink">{agg.name}</p>
                      <p className="text-sm text-muted-warm">{agg.email} · {agg.count} session{agg.count === 1 ? '' : 's'}</p>
                      <p className={`text-xs mt-1 ${agg.details?.payout_method ? 'text-ink' : 'text-red-700'}`}>{describePayout(agg.details)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl text-maroon">₹{Math.round(agg.total).toLocaleString('en-IN')}</p>
                      {belowThreshold(agg.total) && <p className="text-xs text-muted-warm">below ₹500 — roll over</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="All records" count={all.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-warm">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Teacher</th>
                  <th className="py-2 pr-3">Session</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Gross</th>
                  <th className="py-2 pr-3 text-right">Platform</th>
                  <th className="py-2 pr-3 text-right">To teacher</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(0, 200).map((p) => {
                  const d = payoutDate(p);
                  return (
                    <tr key={p.id} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-ink">{p.teacher.profile.full_name}</td>
                      <td className="py-2 pr-3 text-muted-warm text-xs">{payoutSource(p)}{p.is_owner_session ? ' · owner' : ''}</td>
                      <td className="py-2 pr-3 text-muted-warm text-xs">{d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                      <td className="py-2 pr-3 text-right">₹{Math.round(p.gross_amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3 text-right text-muted-warm">₹{Math.round(p.platform_cut).toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3 text-right font-medium">₹{Math.round(p.teacher_amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={p.status} />
                        {p.payment_reference && <span className="ml-2 text-xs text-muted-warm">{p.payment_reference}</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {p.status === 'pending' && <MarkPaidButton payoutId={p.id} />}
                        {p.status === 'paid' && p.paid_at && <span className="text-xs text-muted-warm">{new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-lg border ${accent ? 'border-gold bg-parchment-2' : 'border-line bg-parchment'} p-5`}><p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p><p className={`font-display text-2xl ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p></div>;
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="mb-10"><div className="flex items-baseline justify-between mb-3"><h2 className="font-display text-2xl text-maroon">{title}</h2><span className="text-sm text-muted-warm">{count}</span></div>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">{children}</div>;
}
function StatusBadge({ status }: { status: 'pending' | 'paid' | 'held' }) {
  const cfg = { pending: { bg: 'bg-gold/20', text: 'text-maroon' }, paid: { bg: 'bg-parchment-2', text: 'text-muted-warm' }, held: { bg: 'bg-red-100', text: 'text-red-700' } }[status];
  return <span className={`text-xs px-2 py-0.5 rounded ${cfg.bg} ${cfg.text} capitalize`}>{status}</span>;
}
