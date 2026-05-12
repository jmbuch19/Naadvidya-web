'use client';

import { useState, useEffect } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

const RAZORPAY_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RAZORPAY_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      return;
    }
    const s = document.createElement('script');
    s.src = RAZORPAY_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({
  packageId,
  variant = 'primary',
}: {
  packageId: string;
  variant?: 'primary' | 'inverse';
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadRazorpayScript(); }, []);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });

      if (!orderRes.ok) {
        const j = await orderRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Order creation failed (HTTP ${orderRes.status})`);
      }
      const order = await orderRes.json();

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        throw new Error('Could not load Razorpay checkout. Please try again.');
      }

      const rz = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Naadvidya',
        description: 'Session credits',
        order_id: order.orderId,
        theme: { color: '#8B1A1A' },
        handler: async (resp) => {
          // Server-side webhook will credit the wallet asynchronously.
          // Also POST here to credit immediately if webhook is slow.
          await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              packageId,
            }),
          });
          window.location.href = '/credits?success=1';
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  }

  const className = variant === 'inverse'
    ? 'inline-flex items-center justify-center w-full px-4 py-2.5 rounded font-medium bg-gold text-maroon hover:bg-parchment transition-colors disabled:opacity-60'
    : 'inline-flex items-center justify-center w-full px-4 py-2.5 rounded font-medium bg-maroon-mid text-parchment hover:bg-maroon transition-colors disabled:opacity-60';

  return (
    <div className="w-full">
      <button onClick={handleBuy} disabled={loading} className={className}>
        {loading ? 'Opening checkout…' : 'Buy this pack'}
      </button>
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
