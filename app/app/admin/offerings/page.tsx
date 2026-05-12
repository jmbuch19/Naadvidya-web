import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OFFERING_LABELS, levelRangeLabel, type OfferingType } from '@/lib/offerings';
import { OfferingAdminActions } from '@/components/offerings/OfferingAdminActions';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Offerings — Naadvidya' };

interface OfferingRow {
  id: string;
  offering_type: OfferingType;
  title: string;
  description: string | null;
  min_level: number;
  max_level: number;
  specialization: string | null;
  total_sessions: number | null;
  duration_weeks: number | null;
  price_per_session_inr: number;
  max_students: number;
  prerequisites: string | null;
  curriculum_outline: string | null;
  start_date: string | null;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_note: string | null;
  created_at: string;
  teacher: { profile: { full_name: string; email: string } };
}

export default async function AdminOfferingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/offerings');
  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const { data: offerings } = await supabase
    .from('class_offerings')
    .select('id, offering_type, title, description, min_level, max_level, specialization, total_sessions, duration_weeks, price_per_session_inr, max_students, prerequisites, curriculum_outline, start_date, is_active, approval_status, rejection_note, created_at, teacher:teacher_profiles!class_offerings_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name, email))')
    .order('created_at', { ascending: false })
    .returns<OfferingRow[]>();

  const all = offerings ?? [];
  const pending = all.filter((o) => o.approval_status === 'pending');
  const approved = all.filter((o) => o.approval_status === 'approved');
  const rejected = all.filter((o) => o.approval_status === 'rejected');

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/dashboard" className="text-muted-warm hover:text-maroon-mid">Admin</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/admin/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Admin</Link>
        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Catalog</p>
          <h1 className="font-display text-4xl text-maroon">Workshops &amp; Programmes</h1>
        </div>

        <Section title="Pending review" count={pending.length}>
          {pending.length === 0 ? <Empty>Nothing waiting.</Empty> : <div className="space-y-4">{pending.map((o) => <Card key={o.id} o={o} showActions />)}</div>}
        </Section>

        <Section title="Published" count={approved.length}>
          {approved.length === 0 ? <Empty>No published offerings yet.</Empty> : <div className="space-y-3">{approved.map((o) => <Card key={o.id} o={o} compact />)}</div>}
        </Section>

        {rejected.length > 0 && (
          <Section title="Rejected" count={rejected.length}>
            <div className="space-y-3">{rejected.map((o) => <Card key={o.id} o={o} compact muted />)}</div>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3"><h2 className="font-display text-2xl text-maroon">{title}</h2><span className="text-sm text-muted-warm">{count}</span></div>
      {children}
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">{children}</div>;
}

function Card({ o, showActions, compact, muted }: { o: OfferingRow; showActions?: boolean; compact?: boolean; muted?: boolean }) {
  const meta = `${OFFERING_LABELS[o.offering_type].name} · ${levelRangeLabel(o.min_level, o.max_level)}${o.total_sessions ? ` · ${o.total_sessions} sessions` : ''} · ₹${Math.round(o.price_per_session_inr)}/session${o.max_students > 1 ? ` · up to ${o.max_students}` : ''}`;
  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-line bg-parchment ${muted ? 'opacity-70' : ''}`}>
        <div className="flex-1 min-w-[220px]">
          <p className="font-medium text-ink">{o.title}</p>
          <p className="text-sm text-muted-warm">{o.teacher.profile.full_name} · {meta}</p>
          {o.rejection_note && <p className="text-xs text-red-700 mt-1">Rejected: {o.rejection_note}</p>}
        </div>
        {o.approval_status === 'approved' && <Link href={`/offerings/${o.id}`} className="text-xs text-maroon-mid hover:underline">View</Link>}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-parchment p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm">{OFFERING_LABELS[o.offering_type].name}</span>
          <h3 className="font-display text-xl text-maroon mt-1.5">{o.title}</h3>
          <p className="text-sm text-muted-warm">{o.teacher.profile.full_name} · {o.teacher.profile.email}</p>
          <p className="text-sm text-ink mt-1">{meta}{o.specialization ? ` · ${o.specialization}` : ''}{o.start_date ? ` · starts ${new Date(o.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</p>
          {o.description && <p className="text-sm text-ink mt-2 whitespace-pre-line line-clamp-4">{o.description}</p>}
          {o.prerequisites && <p className="text-sm mt-2"><span className="text-muted-warm">Prerequisites:</span> {o.prerequisites}</p>}
          {o.curriculum_outline && <p className="text-sm mt-2 whitespace-pre-line"><span className="text-muted-warm">Curriculum:</span> {o.curriculum_outline}</p>}
          <p className="text-xs text-muted-warm mt-3">Submitted {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        {showActions && <OfferingAdminActions id={o.id} title={o.title} />}
      </div>
    </div>
  );
}
