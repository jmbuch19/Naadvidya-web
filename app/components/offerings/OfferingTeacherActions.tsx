'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OfferingTeacherActions({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy('toggle'); setError(null);
    try {
      const res = await fetch(`/api/offerings/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm('Delete this offering? Only possible if it has no active enrolments.')) return;
    setBusy('delete'); setError(null);
    try {
      const res = await fetch(`/api/offerings/${id}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button onClick={toggle} disabled={busy !== null} className="text-maroon-mid hover:underline disabled:opacity-50">
        {busy === 'toggle' ? '…' : isActive ? 'Deactivate' : 'Reactivate'}
      </button>
      <span className="text-muted-warm">·</span>
      <button onClick={remove} disabled={busy !== null} className="text-muted-warm hover:text-red-700 disabled:opacity-50">
        {busy === 'delete' ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
