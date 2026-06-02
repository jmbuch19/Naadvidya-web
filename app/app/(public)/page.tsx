import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { AmeeBlock } from '@/components/hero/AmeeBlock';
import { TeacherCard, TeacherCardPlaceholder } from '@/components/teacher-card/TeacherCard';
import { getApprovedTeachers } from '@/lib/supabase/queries';

export const revalidate = 60;

export default async function HomePage() {
  const allTeachers = await getApprovedTeachers();

  // Exclude the owner-admin teaching profile from the "Meet Your Gurus" grid —
  // the curated gurus block above stands for the collective.
  const teachers = allTeachers.filter((t) => !t.profile.is_owner);

  // Always show at least 6 card slots; fill remainder with "Joining Soon" placeholders.
  const slotCount = Math.max(6, teachers.length);
  const placeholders = Math.max(0, slotCount - teachers.length);

  return (
    <>
      <Hero />
      <AmeeBlock />

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-sm text-gold uppercase tracking-widest mb-2">The Faculty</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-maroon">
            Meet Your Gurus
          </h2>
          <p className="mt-4 text-muted-warm max-w-xl mx-auto">
            Every teacher on Naadvidya is personally reviewed by the Naadvidya Gurus. No open marketplace,
            no algorithms — just gurus you can trust.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} />
          ))}
          {Array.from({ length: placeholders }).map((_, i) => (
            <TeacherCardPlaceholder key={`placeholder-${i}`} />
          ))}
        </div>

        {teachers.length > 0 && (
          <div className="text-center mt-12">
            <Link href="/teachers" className="btn-ghost">View all teachers</Link>
          </div>
        )}
      </section>

      <section id="how" className="bg-parchment-2 border-y border-line">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-sm text-gold uppercase tracking-widest mb-2">The Path</p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-maroon">
              How Naadvidya Works
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { n: '01', t: 'Browse', d: 'Discover gurus by raga, instrument, language and fee.' },
              { n: '02', t: 'Book', d: 'Buy a credit pack. Request a session — or a free 15-min trial.' },
              { n: '03', t: 'Learn', d: 'One-on-one inside a private video room. No external apps.' },
              { n: '04', t: 'Practice', d: 'Submit homework. Receive feedback. Return prepared.' },
            ].map((step) => (
              <li key={step.n}>
                <div className="font-display text-3xl text-gold">{step.n}</div>
                <h3 className="font-display text-xl text-maroon mt-2">{step.t}</h3>
                <p className="text-muted-warm mt-2 text-sm leading-relaxed">{step.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
