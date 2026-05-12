'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VoiceRepoRowActions({ id, isPublicSample }: { id: string; isPublicSample: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'sample' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function togglePublic() {
    setBusy('sample');
    setError(null);
    try {
      const res = await fetch(`/api/voice-repo/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makePublicSample: !isPublicSample }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!confirm('Delete this recording? This cannot be undone.')) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await fetch(`/api/voice-repo/${id}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(null); }
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-xs">
      <button onClick={togglePublic} disabled={busy !== null} className="text-maroon-mid hover:underline disabled:opacity-50">
        {busy === 'sample' ? '…' : isPublicSample ? 'Unset as public sample' : 'Set as public sample'}
      </button>
      <span className="text-muted-warm">·</span>
      <button onClick={remove} disabled={busy !== null} className="text-muted-warm hover:text-red-700 disabled:opacity-50">
        {busy === 'delete' ? 'Deleting…' : 'Delete'}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
