'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Student withdraws from an enrolment. Refunds 1 credit per not-yet-happened session.
export function WithdrawButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-sm text-muted-warm hover:text-red-700">Withdraw from this enrolment</button>;
  }
  return (
    <div className="rounded-lg border border-line bg-parchment-2/40 p-4 space-y-3 max-w-md">
      <p className="text-sm text-ink">Withdrawing cancels all your remaining sessions and refunds 1 credit for each session that hasn&rsquo;t happened yet.</p>
      <label className="block">
        <span className="text-sm text-ink">Reason (optional)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={withdraw} disabled={busy} className="px-3 py-1.5 rounded bg-red-700 text-white text-sm hover:bg-red-800 disabled:opacity-60">{busy ? 'Withdrawing…' : 'Confirm withdrawal'}</button>
        <button onClick={() => { setOpen(false); setError(null); }} className="text-sm text-muted-warm hover:text-maroon-mid">Keep my enrolment</button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
