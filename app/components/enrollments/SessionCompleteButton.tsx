'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Teacher marks a scheduled session complete.
export function SessionCompleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    if (!confirm('Mark this session complete? It moves to history and counts toward the enrolment.')) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }

  return (
    <div className="text-right">
      <button onClick={complete} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Marking complete…' : 'Mark complete'}</button>
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
    </div>
  );
}
