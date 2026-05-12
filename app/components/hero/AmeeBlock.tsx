import type { AmeeProfile } from '@/lib/supabase/queries';

// Trust anchor block. NOT a teacher card — Amee is the founder/host.
// If Amee hasn't signed up yet, render the curated placeholder.
export function AmeeBlock({ amee }: { amee: AmeeProfile | null }) {
  return (
    <section id="about" className="bg-parchment-2 border-y border-line">
      <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-[260px_1fr] gap-10 items-center">
        <div className="flex justify-center md:justify-end">
          <div className="w-44 h-44 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-gold shadow-lg bg-parchment flex items-center justify-center">
            {amee?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={amee.avatar_url} alt={amee.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-5xl text-maroon">अ</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-gold uppercase tracking-widest mb-2">Founder &amp; Guru</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-maroon mb-2">
            {amee?.full_name ?? 'Mrs. Amee Buch'}
          </h2>
          <p className="font-display italic text-muted-warm text-lg mb-5">
            Sangeet Visharad · Hindustani Classical Vocal
          </p>
          <p className="text-ink leading-relaxed text-lg max-w-2xl">
            Naadvidya was born from a simple conviction — that the lineage of Indian
            Classical music deserves a digital home that honours its depth. Every guru
            here is personally chosen. Every student is a seeker. This is the academy
            I wished existed when I began my own journey.
          </p>
        </div>
      </div>
    </section>
  );
}
