'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!ref.trim()) {
      setError('Enter a UPI ID / bank reference');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: ref.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded bg-maroon-mid text-parchment hover:bg-maroon"
      >
        Mark paid
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-stretch gap-1 max-w-[220px]">
      <div className="flex gap-1">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="UPI ref / txn ID"
          className="flex-1 px-2 py-1 text-xs rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="text-xs px-2 py-1 rounded bg-maroon-mid text-parchment hover:bg-maroon disabled:opacity-60"
        >
          {busy ? '…' : 'Save'}
        </button>
        <button onClick={() => { setOpen(false); setRef(''); setError(null); }} className="text-xs text-muted-warm">×</button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
