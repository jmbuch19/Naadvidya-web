import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Earnings — Naadvidya' };

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
  booking: { scheduled_at: string | null; student: { full_name: string } } | null;
  scheduled_session: { scheduled_at: string | null; student: { full_name: string }; enrollment: { offering: { title: string } } | null } | null;
}

function payoutWho(p: PayoutRow): { date: string | null; student: string; label: string } {
  if (p.booking) return { date: p.booking.scheduled_at, student: p.booking.student?.full_name ?? '—', label: 'Mehfil' };
  if (p.scheduled_session) return { date: p.scheduled_session.scheduled_at, student: p.scheduled_session.student?.full_name ?? '—', label: p.scheduled_session.enrollment?.offering?.title ?? 'Class' };
  return { date: null, student: '—', label: '—' };
}

export default async function TeacherEarningsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/earnings');

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, session_fee_inr')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string; session_fee_inr: number }>();
  if (!teacher) redirect('/dashboard');

  const [{ data: payouts }, { data: payoutDetails }] = await Promise.all([
    supabase
      .from('payouts')
      .select(`
        id, gross_amount, platform_cut, teacher_amount, is_owner_session,
        status, paid_at, payment_reference, created_at,
        booking:bookings!payouts_booking_id_fkey(scheduled_at, student:profiles!bookings_student_id_fkey(full_name)),
        scheduled_session:scheduled_sessions!payouts_scheduled_session_id_fkey(scheduled_at, student:profiles!scheduled_sessions_student_id_fkey(full_name), enrollment:enrollments!scheduled_sessions_enrollment_id_fkey(offering:class_offerings!enrollments_offering_id_fkey(title)))
      `)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
      .returns<PayoutRow[]>(),
    supabase.from('teacher_payout_details').select('payout_method').eq('teacher_id', teacher.id).maybeSingle<{ payout_method: string | null }>(),
  ]);
  const hasPayoutMethod = !!payoutDetails?.payout_method;

  const all = payouts ?? [];
  const pending = all.filter((p) => p.status === 'pending');
  const paid = all.filter((p) => p.status === 'paid');
  const held = all.filter((p) => p.status === 'held');

  const sum = (arr: PayoutRow[]) => arr.reduce((s, p) => s + Number(p.teacher_amount), 0);
  const pendingTotal = sum(pending);
  const lifetimeTotal = sum(paid);
  const now = new Date();
  const thisMonthPaid = sum(paid.filter((p) => {
    if (!p.paid_at) return false;
    const d = new Date(p.paid_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }));

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teacher/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Earnings</p>
          <h1 className="font-display text-4xl text-maroon">Your payouts</h1>
          <p className="text-muted-warm mt-2 text-sm">
            Amee processes payouts on the 1st and 15th of every month via UPI/bank.
            Minimum ₹500 — smaller balances roll over to the next cycle.
          </p>
        </div>

        {!hasPayoutMethod && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 px-4 py-3 text-sm text-ink">
            ⚠️ You haven&rsquo;t added your payout details — Amee can&rsquo;t pay you until you do.{' '}
            <Link href="/teacher/profile#payout" className="text-maroon-mid hover:underline">Add UPI / bank details →</Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat label="Pending" value={`₹${Math.round(pendingTotal).toLocaleString('en-IN')}`} accent />
          <Stat label="Paid this month" value={`₹${Math.round(thisMonthPaid).toLocaleString('en-IN')}`} />
          <Stat label="Paid lifetime" value={`₹${Math.round(lifetimeTotal).toLocaleString('en-IN')}`} />
          <Stat label="Held (disputes)" value={`₹${Math.round(sum(held)).toLocaleString('en-IN')}`} accent={held.length > 0} />
        </div>

        {all.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">
            No payouts yet. Complete sessions to start earning. Your fee is ₹{Math.round(teacher.session_fee_inr)} per session — 80% (₹{Math.round(teacher.session_fee_inr * 0.8)}) goes to you.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-warm">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Session</th>
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3 text-right">Gross</th>
                  <th className="py-2 pr-3 text-right">Yours</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {all.slice(0, 100).map((p) => {
                  const who = payoutWho(p);
                  return (
                    <tr key={p.id} className="border-b border-line/50">
                      <td className="py-2 pr-3 text-muted-warm text-xs">{who.date ? new Date(who.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                      <td className="py-2 pr-3 text-muted-warm text-xs">{who.label}{p.is_owner_session ? ' · owner' : ''}</td>
                      <td className="py-2 pr-3 text-ink">{who.student}</td>
                      <td className="py-2 pr-3 text-right text-muted-warm">₹{Math.round(p.gross_amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3 text-right font-medium text-ink">₹{Math.round(p.teacher_amount).toLocaleString('en-IN')}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={p.status} />
                        {p.payment_reference && <span className="ml-2 text-xs text-muted-warm">{p.payment_reference}</span>}
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border ${accent ? 'border-gold bg-parchment-2' : 'border-line bg-parchment'} p-5`}>
      <p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p>
      <p className={`font-display text-2xl ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p>
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
