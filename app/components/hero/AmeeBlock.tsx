// Trust anchor block — Naadvidya is guided by a curated circle of gurus,
// not a single individual. Rendered above the faculty grid on the homepage.
export function AmeeBlock() {
  return (
    <section id="about" className="bg-parchment-2 border-y border-line">
      <div className="max-w-5xl mx-auto px-6 py-20 grid md:grid-cols-[260px_1fr] gap-10 items-center">
        <div className="flex justify-center md:justify-end">
          <div className="w-44 h-44 md:w-56 md:h-56 rounded-full overflow-hidden border-4 border-gold shadow-lg bg-parchment flex items-center justify-center">
            <span className="font-display text-5xl text-maroon">अ</span>
          </div>
        </div>

        <div>
          <p className="text-sm text-gold uppercase tracking-widest mb-2">The Naadvidya Gurus</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-maroon mb-2">
            A Curated Circle of Gurus
          </h2>
          <p className="font-display italic text-muted-warm text-lg mb-5">
            Hindustani Classical · A lineage held in many hands
          </p>
          <p className="text-ink leading-relaxed text-lg max-w-2xl">
            Naadvidya was born from a simple conviction — that the lineage of Indian
            Classical music deserves a digital home that honours its depth. Every guru
            here is personally chosen. Every student is a seeker. This is the academy
            we wished existed when we began our own journeys.
          </p>
        </div>
      </div>
    </section>
  );
}
