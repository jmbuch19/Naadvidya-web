import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OFFERING_LABELS, levelRangeLabel, type OfferingType } from '@/lib/offerings';
import { OfferingTeacherActions } from '@/components/offerings/OfferingTeacherActions';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'My offerings — Naadvidya' };

interface OfferingRow {
  id: string;
  offering_type: OfferingType;
  title: string;
  description: string | null;
  min_level: number;
  max_level: number;
  total_sessions: number | null;
  price_per_session_inr: number;
  max_students: number;
  start_date: string | null;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_note: string | null;
  created_at: string;
  enrollments: { id: string }[];
}

export default async function TeacherOfferingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/offerings');

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id, approval_status').eq('profile_id', user.id).maybeSingle<{ id: string; approval_status: string }>();
  if (!teacher) redirect('/dashboard');

  const { data: offerings } = await supabase
    .from('class_offerings')
    .select('id, offering_type, title, description, min_level, max_level, total_sessions, price_per_session_inr, max_students, start_date, is_active, approval_status, rejection_note, created_at, enrollments(id)')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })
    .returns<OfferingRow[]>();

  const all = offerings ?? [];

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teacher/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>
        <div className="mt-4 mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">Catalog</p>
            <h1 className="font-display text-4xl text-maroon">Workshops &amp; Programmes</h1>
          </div>
          {teacher.approval_status === 'approved' && (
            <Link href="/teacher/offerings/new" className="btn-primary !py-2 !px-4 text-sm shrink-0">+ New offering</Link>
          )}
        </div>

        {teacher.approval_status !== 'approved' && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 p-4 text-sm text-ink">
            Once Amee approves your teacher profile you can create Workshops and Gurukul Programmes here.
          </div>
        )}

        {all.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-8 text-center text-muted-warm">
            No offerings yet. {teacher.approval_status === 'approved' && <>Create a <Link href="/teacher/offerings/new" className="text-maroon-mid hover:underline">Riyaaz Workshop or Gurukul Path</Link>.</>}
          </div>
        ) : (
          <div className="space-y-4">
            {all.map((o) => {
              const enrolCount = o.enrollments?.length ?? 0;
              return (
                <div key={o.id} className={`rounded-lg border border-line bg-parchment p-5 ${o.is_active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm">{OFFERING_LABELS[o.offering_type].name}</span>
                        <StatusBadge status={o.approval_status} active={o.is_active} />
                      </div>
                      <h2 className="font-display text-xl text-maroon mt-1.5">{o.title}</h2>
                      <p className="text-sm text-muted-warm mt-0.5">
                        {levelRangeLabel(o.min_level, o.max_level)}
                        {o.total_sessions ? ` · ${o.total_sessions} sessions` : ''}
                        {` · ₹${Math.round(o.price_per_session_inr)}/session`}
                        {o.max_students > 1 ? ` · up to ${o.max_students} students` : ''}
                        {o.start_date ? ` · starts ${new Date(o.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                        {` · ${enrolCount} enrolled`}
                      </p>
                      {o.rejection_note && <p className="text-xs text-red-700 mt-1.5">Rejected: {o.rejection_note}</p>}
                      {o.description && <p className="text-sm text-ink mt-2 line-clamp-2">{o.description}</p>}
                      <div className="mt-3"><OfferingTeacherActions id={o.id} isActive={o.is_active} /></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, active }: { status: 'pending' | 'approved' | 'rejected'; active: boolean }) {
  if (!active) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm uppercase tracking-widest">Inactive</span>;
  const cfg = {
    pending: { bg: 'bg-orange-100', text: 'text-orange-900', label: 'Pending approval' },
    approved: { bg: 'bg-gold/20', text: 'text-maroon', label: 'Live' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  }[status];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} uppercase tracking-widest`}>{cfg.label}</span>;
}
