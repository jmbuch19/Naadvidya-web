'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = 'confirm' | 'cancel';

export function BookingActions({
  bookingId,
  showConfirm,
  showCancel,
}: {
  bookingId: string;
  showConfirm: boolean;
  showCancel: boolean;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run(action: Action) {
    if (action === 'cancel' && !confirm('Cancel this session? The student will be refunded their credit.')) return;
    setBusy(action);
    setError(null);
    try {
      const url = action === 'confirm'
        ? `/api/bookings/${bookingId}/confirm`
        : `/api/bookings/${bookingId}/cancel`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'cancel' ? JSON.stringify({ reason: 'Teacher cancelled' }) : '{}',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Action failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {showConfirm && (
          <button
            onClick={() => run('confirm')}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded text-sm bg-maroon-mid text-parchment hover:bg-maroon disabled:opacity-60"
          >
            {busy === 'confirm' ? 'Confirming…' : 'Confirm'}
          </button>
        )}
        {showCancel && (
          <button
            onClick={() => run('cancel')}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded text-sm border border-line text-muted-warm hover:border-red-500 hover:text-red-700 disabled:opacity-60"
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Decline'}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
