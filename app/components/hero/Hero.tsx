import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-parchment">
      {/* subtle tanpura drone texture — gradient-only for Phase 1 */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(197,160,40,0.25), transparent), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(139,26,26,0.15), transparent)',
        }}
      />
      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
        <p className="font-display italic text-gold tracking-wider text-base md:text-lg mb-4">
          ॐ नादब्रह्मणे नमः
        </p>

        <div className="max-w-3xl mx-auto mb-10 space-y-3 font-display italic text-muted-warm">
          <p className="text-base md:text-lg leading-relaxed">
            ध्वनि (नाद) ही ईश्वर (ब्रह्म) है — उस ध्वनि-स्वरूप परमात्मा को मेरा नमन।
          </p>
          <p className="text-sm md:text-base leading-relaxed">
            Sound itself is the divine. We bow to that Supreme who is the very essence of sound.
          </p>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-semibold text-maroon leading-tight text-balance">
          Learn Classical Music from India&rsquo;s Finest Gurus
        </h1>
        <p className="mt-6 text-lg text-muted-warm max-w-2xl mx-auto leading-relaxed">
          A curated, invitation-only academy for Indian Classical music at Visharad
          level and beyond. Guided by the Naadvidya Gurus.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/teachers" className="btn-primary">Meet Your Gurus</Link>
          <Link href="/register" className="btn-ghost">Begin Your Sadhana</Link>
        </div>
      </div>
    </section>
  );
}
