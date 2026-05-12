import Link from 'next/link';
import { PluginShelf } from '@/components/plugins/PluginShelf';

export const metadata = {
  title: 'Practice Tools — Naadvidya',
  description: 'Tanpura drone and a taal-aware practice timer. Free, runs in your browser.',
};

export default function PracticePage() {
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <Link href="/teachers" className="text-muted-warm hover:text-maroon-mid">Teachers</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Practice Tools</p>
          <h1 className="font-display text-4xl text-maroon">Riyaaz companions</h1>
          <p className="mt-2 text-muted-warm max-w-2xl">
            A tanpura drone for pitch and a taal-aware timer for laya. Both run entirely in your
            browser — no app, no account needed. Keep this tab open while you practise.
          </p>
        </div>

        <PluginShelf />

        <p className="mt-10 text-xs text-muted-warm">
          Tip: on a phone, add Naadvidya to your home screen (the install prompt in your browser) so
          these tools are one tap away.
        </p>
      </main>
    </div>
  );
}
