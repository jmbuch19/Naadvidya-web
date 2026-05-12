import Link from 'next/link';
import { getPublicOfferings } from '@/lib/supabase/offerings-queries';
import { OFFERING_LABELS, levelRangeLabel, type OfferingType } from '@/lib/offerings';

export const revalidate = 60;
export const metadata = {
  title: 'Workshops & Programmes — Naadvidya',
  description: 'Riyaaz Workshops and Gurukul Paths from Naadvidya teachers — fixed-scope deep dives and progressive long-term curricula.',
};

export default async function OfferingsPage({ searchParams }: { searchParams: { type?: string } }) {
  const type = (['gurukul_path', 'riyaaz_workshop', 'mehfil_session'] as const).includes(searchParams.type as OfferingType)
    ? (searchParams.type as OfferingType) : undefined;
  const offerings = await getPublicOfferings({ type });

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <header className="mb-8">
        <p className="text-sm text-gold uppercase tracking-widest mb-2">The Curriculum</p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-maroon">Workshops &amp; Programmes</h1>
        <p className="mt-4 text-muted-warm max-w-2xl">
          Beyond one-off Mehfil sessions: fixed-scope <strong>Riyaaz Workshops</strong> and progressive
          long-term <strong>Gurukul Paths</strong>, each created by a Naadvidya teacher and reviewed by Amee.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { v: undefined, label: 'All' },
          { v: 'riyaaz_workshop', label: 'Riyaaz Workshops' },
          { v: 'gurukul_path', label: 'Gurukul Paths' },
          { v: 'mehfil_session', label: 'Mehfil Series' },
        ].map((f) => {
          const active = type === f.v || (!type && !f.v);
          const href = f.v ? `/offerings?type=${f.v}` : '/offerings';
          return (
            <Link key={f.label} href={href} className={`text-xs px-3 py-1.5 rounded-full border ${active ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line text-muted-warm hover:border-maroon-mid'}`}>
              {f.label}
            </Link>
          );
        })}
      </div>

      {offerings.length === 0 ? (
        <div className="bg-parchment-2 border border-line rounded-lg p-12 text-center">
          <h2 className="font-display text-2xl text-maroon mb-2">Nothing here yet</h2>
          <p className="text-muted-warm">Our teachers are putting their Workshops and Programmes together. Check back soon — or <Link href="/teachers" className="text-maroon-mid hover:underline">book a Mehfil session</Link> in the meantime.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offerings.map((o) => (
            <Link key={o.id} href={`/offerings/${o.id}`} className="group block rounded-lg border border-line bg-parchment p-5 hover:border-maroon-mid transition-colors">
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm">{OFFERING_LABELS[o.offering_type].name}</span>
              <h3 className="font-display text-xl text-maroon mt-2 group-hover:text-maroon-mid">{o.title}</h3>
              <p className="text-sm text-muted-warm mt-1">with {o.teacher.profile.full_name}</p>
              <p className="text-sm text-muted-warm mt-2">
                {levelRangeLabel(o.min_level, o.max_level)}
                {o.total_sessions ? ` · ${o.total_sessions} sessions` : ''}
              </p>
              {o.description && <p className="text-sm text-ink mt-3 line-clamp-3">{o.description}</p>}
              <p className="mt-4 text-sm text-muted-warm">₹{Math.round(o.price_per_session_inr)} per session{o.max_students > 1 ? ` · up to ${o.max_students} students` : ''}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
