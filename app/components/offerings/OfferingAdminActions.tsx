'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OfferingAdminActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!confirm(`Approve "${title}" and publish it?`)) return;
    setBusy('approve'); setError(null);
    try {
      const res = await fetch(`/api/admin/offerings/${id}/approve`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  async function reject() {
    if (reason.trim().length < 5) { setError('Rejection note must be ≥5 characters'); return; }
    setBusy('reject'); setError(null);
    try {
      const res = await fetch(`/api/admin/offerings/${id}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 min-w-[200px]">
      {!showReject ? (
        <>
          <button onClick={approve} disabled={busy !== null} className="px-3 py-1.5 rounded bg-maroon-mid text-parchment text-sm hover:bg-maroon disabled:opacity-60">
            {busy === 'approve' ? 'Approving…' : 'Approve & publish'}
          </button>
          <button onClick={() => setShowReject(true)} disabled={busy !== null} className="px-3 py-1.5 rounded border border-line text-muted-warm text-sm hover:border-red-500 hover:text-red-700">
            Reject
          </button>
        </>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason — sent to the teacher."
            className="w-full px-2 py-1.5 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" />
          <div className="flex gap-2">
            <button onClick={reject} disabled={busy !== null || reason.trim().length < 5} className="flex-1 px-3 py-1.5 rounded bg-red-700 text-white text-sm hover:bg-red-800 disabled:opacity-60">
              {busy === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </button>
            <button onClick={() => { setShowReject(false); setReason(''); setError(null); }} className="px-3 py-1.5 rounded border border-line text-muted-warm text-sm">Cancel</button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
