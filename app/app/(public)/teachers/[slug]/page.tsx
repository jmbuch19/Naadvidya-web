import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTeacherBySlug } from '@/lib/supabase/queries';

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps) {
  const teacher = await getTeacherBySlug(params.slug);
  if (!teacher) return { title: 'Teacher not found — Naadvidya' };
  return {
    title: `${teacher.profile.full_name} — Naadvidya`,
    description: teacher.bio?.slice(0, 160) ?? 'A Naadvidya guru.',
  };
}

export default async function TeacherProfilePage({ params }: PageProps) {
  const teacher = await getTeacherBySlug(params.slug);
  if (!teacher) notFound();

  const profile = teacher.profile;
  const initials = profile.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <article className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/teachers" className="text-sm text-muted-warm hover:text-maroon-mid">
        ← Back to all teachers
      </Link>

      <header className="mt-6 grid md:grid-cols-[280px_1fr] gap-10 items-start">
        <div className="w-full max-w-[280px] aspect-square rounded-lg overflow-hidden border border-line bg-parchment-2 flex items-center justify-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-6xl text-maroon-mid">{initials}</span>
          )}
        </div>

        <div>
          <h1 className="font-display text-4xl md:text-5xl font-semibold text-maroon">
            {profile.full_name}
          </h1>
          {teacher.sangeet_qualifications?.length ? (
            <p className="text-gold font-display italic text-lg mt-2">
              {teacher.sangeet_qualifications.join(' · ')}
            </p>
          ) : null}
          {profile.city && (
            <p className="text-muted-warm text-sm mt-1">{profile.city}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {teacher.specializations?.map((s) => (
              <span key={s} className="text-sm px-3 py-1 rounded-full bg-parchment-2 border border-line text-ink">
                {s}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href={`/book/${teacher.id}`} className="btn-primary">
              Request Session
            </Link>
            <Link href={`/book/${teacher.id}?trial=1`} className="btn-ghost">
              Free 15-min Trial
            </Link>
            <span className="text-sm text-muted-warm">
              ₹{Math.round(teacher.session_fee_inr)} / 60-min session
            </span>
          </div>
        </div>
      </header>

      {teacher.bio && (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="font-display text-2xl text-maroon mb-4">About</h2>
          <p className="text-ink leading-relaxed whitespace-pre-line">{teacher.bio}</p>
        </section>
      )}

      <section className="mt-10 grid md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-display text-lg text-maroon mb-2">Ragas taught</h3>
          {teacher.ragas_taught?.length ? (
            <ul className="text-sm text-muted-warm space-y-1">
              {teacher.ragas_taught.map((r) => <li key={r}>{r}</li>)}
            </ul>
          ) : <p className="text-sm text-muted-warm italic">To be specified</p>}
        </div>

        <div>
          <h3 className="font-display text-lg text-maroon mb-2">Languages</h3>
          <p className="text-sm text-muted-warm">{teacher.languages?.join(', ') ?? '—'}</p>
        </div>

        <div>
          <h3 className="font-display text-lg text-maroon mb-2">Experience</h3>
          <p className="text-sm text-muted-warm">
            {teacher.years_experience ? `${teacher.years_experience} years` : '—'}
          </p>
        </div>
      </section>

      {teacher.intro_video_url && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-maroon mb-4">Introduction</h2>
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            <video src={teacher.intro_video_url} controls className="w-full h-full" />
          </div>
        </section>
      )}
    </article>
  );
}
