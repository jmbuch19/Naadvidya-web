import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicOffering } from '@/lib/supabase/offerings-queries';
import { OFFERING_LABELS, levelRangeLabel } from '@/lib/offerings';

export const revalidate = 60;

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
        <h2 className="font-display text-xl text-maroon mb-1">
          {isGurukul ? 'Applying to this Gurukul Path' : 'Joining this workshop'}
        </h2>
        <p className="text-muted-warm text-sm">
          {isGurukul
            ? 'Gurukul enrolment is by application — you share a short note about your background and the teacher accepts you for their programme. '
            : 'Enrolment reserves one credit per session and locks in your seat. '}
          Enrolment opens here shortly. In the meantime you can{' '}
          {o.teacher.slug
            ? <Link href={`/book/${o.teacher.id}?trial=1`} className="text-maroon-mid hover:underline">book a free 15-min trial with {o.teacher.profile.full_name.split(' ')[0]}</Link>
            : 'browse other teachers'}
          {' '}or{' '}
          <Link href="/teachers" className="text-maroon-mid hover:underline">a one-off Mehfil session</Link>.
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
