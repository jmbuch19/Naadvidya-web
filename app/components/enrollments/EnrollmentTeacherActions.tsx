'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Accept / decline a pending Gurukul application (teacher side).
export function EnrollmentTeacherActions({ enrollmentId, studentName }: { enrollmentId: string; studentName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!confirm(`Accept ${studentName} into this programme? You'll then set up their session schedule.`)) return;
    setBusy('accept'); setError(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/accept`, { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  async function decline() {
    setBusy('decline'); setError(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/decline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 min-w-[200px]">
      {!showDecline ? (
        <>
          <button onClick={accept} disabled={busy !== null} className="px-3 py-1.5 rounded bg-maroon-mid text-parchment text-sm hover:bg-maroon disabled:opacity-60">
            {busy === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
          <button onClick={() => setShowDecline(true)} disabled={busy !== null} className="px-3 py-1.5 rounded border border-line text-muted-warm text-sm hover:border-red-500 hover:text-red-700">Decline</button>
        </>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (optional, shown to the student)"
            className="w-full px-2 py-1.5 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" />
          <div className="flex gap-2">
            <button onClick={decline} disabled={busy !== null} className="flex-1 px-3 py-1.5 rounded bg-red-700 text-white text-sm hover:bg-red-800 disabled:opacity-60">{busy === 'decline' ? 'Declining…' : 'Confirm decline'}</button>
            <button onClick={() => { setShowDecline(false); setReason(''); setError(null); }} className="px-3 py-1.5 rounded border border-line text-muted-warm text-sm">Cancel</button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
