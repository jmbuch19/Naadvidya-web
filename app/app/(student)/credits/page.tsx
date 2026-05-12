import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CheckoutButton } from '@/components/credits/CheckoutButton';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Buy Credits — Naadvidya' };

interface Pack {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_inr: number;
  sort_order: number;
}

interface CreditsRow {
  credits_balance: number;
}

export default async function CreditsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/credits');

  const [{ data: packs }, { data: credits }] = await Promise.all([
    supabase
      .from('session_packages')
      .select('id, name, description, credits, price_inr, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .returns<Pack[]>(),
    supabase
      .from('student_credits')
      .select('credits_balance')
      .eq('student_id', user.id)
      .maybeSingle<CreditsRow>(),
  ]);

  const balance = credits?.credits_balance ?? 0;

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">Session Credits</p>
            <h1 className="font-display text-4xl text-maroon">Buy your credit pack</h1>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-warm">Your balance</p>
            <p className="font-display text-3xl text-maroon">{balance}</p>
            <p className="text-xs text-muted-warm">sessions</p>
          </div>
        </div>

        <p className="text-muted-warm mb-10 max-w-2xl">
          Each credit is one 60-minute session with any approved teacher. Credits never
          expire while your account is active. Cancel a session 48+ hours in advance for a
          full refund.
        </p>

        {!packs?.length ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-8 text-center text-muted-warm">
            Credit packs aren&rsquo;t configured yet. Check back soon.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {packs.map((pack, i) => {
              const perSession = Math.round(pack.price_inr / pack.credits);
              const isBest = i === 2; // Ashtadhatu highlighted
              return (
                <div
                  key={pack.id}
                  className={`rounded-lg p-6 flex flex-col ${
                    isBest
                      ? 'bg-maroon-mid text-parchment border-2 border-gold'
                      : 'bg-parchment border border-line'
                  }`}
                >
                  {isBest && (
                    <span className="text-xs uppercase tracking-widest text-gold mb-2">Best value</span>
                  )}
                  <h2 className={`font-display text-2xl ${isBest ? 'text-parchment' : 'text-maroon'}`}>
                    {pack.name}
                  </h2>
                  {pack.description && (
                    <p className={`text-sm mt-1 ${isBest ? 'text-parchment/80' : 'text-muted-warm'}`}>
                      {pack.description}
                    </p>
                  )}
                  <div className="mt-6">
                    <p className={`text-3xl font-display ${isBest ? 'text-parchment' : 'text-maroon'}`}>
                      ₹{Math.round(pack.price_inr).toLocaleString('en-IN')}
                    </p>
                    <p className={`text-sm ${isBest ? 'text-parchment/80' : 'text-muted-warm'}`}>
                      {pack.credits} sessions · ₹{perSession.toLocaleString('en-IN')} each
                    </p>
                  </div>

                  <div className="mt-6 flex-1 flex items-end">
                    <CheckoutButton packageId={pack.id} variant={isBest ? 'inverse' : 'primary'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-xs text-muted-warm">
          Payments processed securely by Razorpay. By purchasing, you agree to our{' '}
          <Link href="/legal/refunds" className="underline">Cancellation &amp; Refund Policy</Link>.
        </p>
      </main>
    </div>
  );
}
