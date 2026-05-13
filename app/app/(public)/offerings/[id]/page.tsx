import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicOffering } from '@/lib/supabase/offerings-queries';
import { OFFERING_LABELS, levelRangeLabel } from '@/lib/offerings';
import { createClient } from '@/lib/supabase/server';
import { EnrollButton } from '@/components/enrollments/EnrollButton';
import { GurukulApplyForm } from '@/components/enrollments/GurukulApplyForm';

interface PageProps { params: { id: string } }

export async function generateMetadata({ params }: PageProps) {
  const o = await getPublicOffering(params.id);
  if (!o) return { title: 'Offering not found — Naadvidya' };
  return { title: `${o.title} — Naadvidya`, description: o.description?.slice(0, 160) ?? `${OFFERING_LABELS[o.offering_type].name} with ${o.teacher.profile.full_name}.` };
}

export default async function OfferingDetailPage({ params }: PageProps) {
  const o = await getPublicOffering(params.id);
  if (!o) notFound();

  const isWorkshop = o.offering_type === 'riyaaz_workshop';
  const isGurukul = o.offering_type === 'gurukul_path';
  const schedule = Array.isArray(o.session_schedule) ? o.session_schedule : [];
  const n = o.total_sessions ?? schedule.length;
  const workshopStarted = isWorkshop && schedule.length > 0 && new Date(schedule[0]).getTime() <= Date.now();

  // Is the current viewer (if signed in) already enrolled/applied?
  let myEnrolment: 'pending' | 'active' | 'paused' | 'declined' | null = null;
  let isStudent = true;
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
      isStudent = !prof?.role || prof.role === 'student';
      const { data: enr } = await sb
        .from('enrollments').select('status').eq('offering_id', o.id).eq('student_id', user.id)
        .in('status', ['pending', 'active', 'paused', 'declined']).order('created_at', { ascending: false }).limit(1).maybeSingle<{ status: 'pending' | 'active' | 'paused' | 'declined' }>();
      myEnrolment = enr?.status ?? null;
    }
  } catch { /* anon / not configured — fine */ }

  return (
    <article className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/offerings" className="text-sm text-muted-warm hover:text-maroon-mid">← All workshops &amp; programmes</Link>

      <header className="mt-4 mb-8">
        <span className="text-[11px] uppercase tracking-widest px-2 py-0.5 rounded bg-parchment-2 text-muted-warm">{OFFERING_LABELS[o.offering_type].name}</span>
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-maroon mt-2">{o.title}</h1>
        <p className="text-muted-warm mt-1">
          with{' '}
          {o.teacher.slug
            ? <Link href={`/teachers/${o.teacher.slug}`} className="text-maroon-mid hover:underline">{o.teacher.profile.full_name}</Link>
            : o.teacher.profile.full_name}
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm mb-8">
        <Fact label="Level" value={levelRangeLabel(o.min_level, o.max_level)} />
        {o.specialization && <Fact label="Focus" value={o.specialization} />}
        {o.total_sessions && <Fact label="Sessions" value={`${o.total_sessions}`} />}
        {o.duration_weeks && <Fact label="Duration" value={`~${o.duration_weeks} weeks`} />}
        <Fact label="Sessions / week" value={`${o.sessions_per_week}`} />
        <Fact label="Fee" value={`₹${Math.round(o.price_per_session_inr)} per session (1 credit/session)`} />
        <Fact label="Group size" value={o.max_students > 1 ? `Up to ${o.max_students} students` : 'One-on-one'} />
        {o.start_date && <Fact label="Starts" value={new Date(o.start_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />}
      </div>

      {o.description && (
        <section className="mb-8 border-t border-line pt-8">
          <h2 className="font-display text-2xl text-maroon mb-3">About this {isWorkshop ? 'workshop' : 'programme'}</h2>
          <p className="text-ink leading-relaxed whitespace-pre-line">{o.description}</p>
        </section>
      )}

      {o.prerequisites && (
        <section className="mb-8">
          <h2 className="font-display text-xl text-maroon mb-2">Prerequisites</h2>
          <p className="text-ink whitespace-pre-line">{o.prerequisites}</p>
        </section>
      )}

      {o.curriculum_outline && (
        <section className="mb-8">
          <h2 className="font-display text-xl text-maroon mb-2">Curriculum outline</h2>
          <p className="text-ink whitespace-pre-line">{o.curriculum_outline}</p>
        </section>
      )}

      {isWorkshop && schedule.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl text-maroon mb-2">Schedule</h2>
          <p className="text-sm text-muted-warm mb-2">All {schedule.length} sessions are fixed — no late entry once the workshop starts.</p>
          <ol className="text-sm text-ink space-y-1">
            {schedule.map((iso, i) => (
              <li key={iso}>
                <span className="text-muted-warm">Session {i + 1}:</span>{' '}
                {new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} IST
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-10 rounded-lg border border-line bg-parchment-2 p-6">
        <h2 className="font-display text-xl text-maroon mb-2">
          {isGurukul ? 'Apply to this Gurukul Path' : 'Join this workshop'}
        </h2>

        {!isStudent ? (
          <p className="text-muted-warm text-sm">Enrolment is for students. (You&rsquo;re signed in as a teacher/admin.)</p>
        ) : isGurukul ? (
          <>
            <p className="text-muted-warm text-sm mb-3">
              By application — you share a short note about your background and what you hope to learn,
              and the teacher accepts you. Once accepted, they set up your recurring schedule and the
              term&rsquo;s credits are reserved.
            </p>
            <GurukulApplyForm offeringId={o.id} alreadyApplied={myEnrolment} />
          </>
        ) : workshopStarted ? (
          <p className="text-muted-warm text-sm">This workshop has already started — no late entry. {o.teacher.slug && <Link href={`/teachers/${o.teacher.slug}`} className="text-maroon-mid hover:underline">See the teacher&rsquo;s other offerings</Link>}.</p>
        ) : (
          <>
            <p className="text-muted-warm text-sm mb-3">
              Enrolling reserves {n} credit{n === 1 ? '' : 's'} (one per session) and locks in all session dates above.
            </p>
            <EnrollButton offeringId={o.id} sessions={n} alreadyEnrolled={myEnrolment === 'active' || myEnrolment === 'paused'} />
          </>
        )}

        <p className="text-muted-warm text-xs mt-4">
          Not ready? You can also{' '}
          {o.teacher.slug
            ? <Link href={`/book/${o.teacher.id}?trial=1`} className="text-maroon-mid hover:underline">book a free 15-min trial with {o.teacher.profile.full_name.split(' ')[0]}</Link>
            : 'browse other teachers'}
          {' '}or a <Link href="/teachers" className="text-maroon-mid hover:underline">one-off Mehfil session</Link>.
        </p>
      </section>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-warm">{label}: </span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
