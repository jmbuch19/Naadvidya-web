'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CompleteButton({ bookingId }: { bookingId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function complete() {
    if (!confirm('Mark this session as complete? This will move it to your history and queue the payout.')) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Complete failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="text-right">
      <button onClick={complete} disabled={submitting} className="btn-primary disabled:opacity-60">
        {submitting ? 'Marking complete…' : 'Mark complete'}
      </button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
