import { TeacherCard, TeacherCardPlaceholder } from '@/components/teacher-card/TeacherCard';
import { getApprovedTeachers } from '@/lib/supabase/queries';

export const revalidate = 60;

export const metadata = {
  title: 'Teachers — Naadvidya',
  description:
    'Meet the curated faculty of Naadvidya. Every guru is personally reviewed by the Naadvidya Gurus.',
};

export default async function TeachersPage() {
  const teachers = (await getApprovedTeachers()).filter((t) => !t.profile.is_owner);
  const placeholders = Math.max(0, 6 - teachers.length);

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <header className="mb-10">
        <p className="text-sm text-gold uppercase tracking-widest mb-2">The Faculty</p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-maroon">
          Naadvidya Teachers
        </h1>
        <p className="mt-4 text-muted-warm max-w-2xl">
          A curated faculty of Sangeet Visharads and accomplished performers. Each
          teacher has been personally reviewed by the Naadvidya Gurus.
        </p>
      </header>

      {teachers.length === 0 && placeholders === 6 ? (
        <div className="bg-parchment-2 border border-line rounded-lg p-12 text-center">
          <h2 className="font-display text-2xl text-maroon mb-2">Teachers joining soon</h2>
          <p className="text-muted-warm">
            We&rsquo;re in conversation with India&rsquo;s finest gurus. Check back shortly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} />
          ))}
          {Array.from({ length: placeholders }).map((_, i) => (
            <TeacherCardPlaceholder key={`placeholder-${i}`} />
          ))}
        </div>
      )}
    </section>
  );
}
