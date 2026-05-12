import Link from 'next/link';
import type { PublicTeacher } from '@/lib/supabase/queries';

export function TeacherCard({ teacher }: { teacher: PublicTeacher }) {
  const profile = teacher.profile;
  const slug = teacher.slug ?? teacher.id;
  const specs = teacher.specializations?.slice(0, 3) ?? [];
  const initials = profile.full_name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link
      href={`/teachers/${slug}`}
      className="group block bg-parchment border border-line rounded-lg overflow-hidden hover:border-maroon-mid transition-colors"
    >
      <div className="aspect-[4/3] bg-parchment-2 flex items-center justify-center overflow-hidden">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <span className="font-display text-5xl text-maroon-mid">{initials}</span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-display text-xl font-semibold text-maroon group-hover:text-maroon-mid">
          {profile.full_name}
        </h3>
        {teacher.sangeet_qualifications?.length ? (
          <p className="text-sm text-gold mt-1">{teacher.sangeet_qualifications[0]}</p>
        ) : null}

        {specs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {specs.map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-1 rounded-full bg-parchment-2 border border-line text-muted-warm"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm text-muted-warm">
          From ₹{Math.round(teacher.session_fee_inr)} per session
        </p>
      </div>
    </Link>
  );
}

export function TeacherCardPlaceholder({ label = 'Joining Soon' }: { label?: string }) {
  return (
    <div className="block bg-parchment-2/40 border border-dashed border-line rounded-lg overflow-hidden">
      <div className="aspect-[4/3] flex items-center justify-center">
        <span className="font-display text-3xl text-muted-warm/60 italic">{label}</span>
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl text-muted-warm/70">A guru to be revealed</h3>
        <p className="text-sm text-muted-warm/60 mt-2">
          Naadvidya curates each teacher carefully. The next one is in conversation.
        </p>
      </div>
    </div>
  );
}
