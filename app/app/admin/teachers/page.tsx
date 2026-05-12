import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TeacherApprovalActions } from '@/components/admin/TeacherApprovalActions';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Teachers — Naadvidya' };

interface TeacherProfileRow {
  id: string;
  bio: string | null;
  years_experience: number;
  sangeet_qualifications: string[];
  specializations: string[];
  session_fee_inr: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_note: string | null;
  is_visible: boolean;
  slug: string | null;
  created_at: string;
  approved_at: string | null;
  profile: { id: string; full_name: string; email: string; city: string | null };
}

export default async function AdminTeachersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/teachers');

  const { data: caller } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle<{ role: string; full_name: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const { data: teachers } = await supabase
    .from('teacher_profiles')
    .select(`
      id, bio, years_experience, sangeet_qualifications, specializations,
      session_fee_inr, approval_status, rejection_note, is_visible, slug,
      created_at, approved_at,
      profile:profiles!teacher_profiles_profile_id_fkey(id, full_name, email, city)
    `)
    .order('created_at', { ascending: false })
    .returns<TeacherProfileRow[]>();

  const pending = (teachers ?? []).filter((t) => t.approval_status === 'pending');
  const approved = (teachers ?? []).filter((t) => t.approval_status === 'approved');
  const rejected = (teachers ?? []).filter((t) => t.approval_status === 'rejected');

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/dashboard" className="text-muted-warm hover:text-maroon-mid">Admin</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/admin/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Admin</Link>
        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Faculty</p>
          <h1 className="font-display text-4xl text-maroon">Teacher approvals</h1>
        </div>

        <Section title="Pending review" count={pending.length} highlight>
          {pending.length === 0 ? (
            <Empty>No teacher applications waiting.</Empty>
          ) : (
            <div className="space-y-4">
              {pending.map((t) => <TeacherCard key={t.id} t={t} showActions />)}
            </div>
          )}
        </Section>

        <Section title="Active teachers" count={approved.length}>
          {approved.length === 0 ? (
            <Empty>No approved teachers yet.</Empty>
          ) : (
            <div className="space-y-3">
              {approved.map((t) => <TeacherCard key={t.id} t={t} compact />)}
            </div>
          )}
        </Section>

        {rejected.length > 0 && (
          <Section title="Rejected" count={rejected.length}>
            <div className="space-y-3">
              {rejected.map((t) => <TeacherCard key={t.id} t={t} compact muted />)}
            </div>
          </Section>
        )}
      </main>
    </div>
  );
}

function Section({ title, count, highlight, children }: { title: string; count: number; highlight?: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`font-display text-2xl ${highlight && count > 0 ? 'text-maroon' : 'text-maroon'}`}>{title}</h2>
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

function TeacherCard({ t, showActions, compact, muted }: { t: TeacherProfileRow; showActions?: boolean; compact?: boolean; muted?: boolean }) {
  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-line bg-parchment ${muted ? 'opacity-70' : ''}`}>
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-ink">{t.profile.full_name}</p>
          <p className="text-sm text-muted-warm">
            {t.profile.email} · ₹{Math.round(t.session_fee_inr)}/session
            {t.specializations?.length ? ` · ${t.specializations.slice(0, 3).join(', ')}` : ''}
          </p>
          {t.rejection_note && (
            <p className="text-xs text-red-700 mt-1">Rejected: {t.rejection_note}</p>
          )}
        </div>
        {t.slug && t.approval_status === 'approved' && (
          <Link href={`/teachers/${t.slug}`} className="text-xs text-maroon-mid hover:underline">
            /teachers/{t.slug}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-parchment p-5">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-xl text-maroon">{t.profile.full_name}</h3>
          <p className="text-sm text-muted-warm">
            {t.profile.email} {t.profile.city && `· ${t.profile.city}`}
          </p>

          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-warm">Fee:</span>{' '}
              <span className="text-ink">₹{Math.round(t.session_fee_inr)} / session</span>
            </div>
            <div>
              <span className="text-muted-warm">Experience:</span>{' '}
              <span className="text-ink">{t.years_experience} years</span>
            </div>
          </div>

          {t.sangeet_qualifications?.length > 0 && (
            <p className="mt-2 text-sm">
              <span className="text-muted-warm">Qualifications:</span>{' '}
              <span className="text-ink">{t.sangeet_qualifications.join(' · ')}</span>
            </p>
          )}

          {t.specializations?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.specializations.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-parchment-2 border border-line text-muted-warm">
                  {s}
                </span>
              ))}
            </div>
          )}

          {t.bio && (
            <p className="mt-3 text-sm text-ink whitespace-pre-line line-clamp-4">{t.bio}</p>
          )}

          <p className="mt-3 text-xs text-muted-warm">
            Applied {new Date(t.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        </div>

        {showActions && <TeacherApprovalActions teacherId={t.id} fullName={t.profile.full_name} />}
      </div>
    </div>
  );
}
