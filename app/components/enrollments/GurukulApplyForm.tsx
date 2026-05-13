'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Gurukul Path application: student writes a short intent; teacher accepts/declines later.
export function GurukulApplyForm({ offeringId, alreadyApplied }: { offeringId: string; alreadyApplied?: 'pending' | 'active' | 'paused' | 'declined' | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyApplied === 'pending') return <p className="text-sm text-maroon">Your application is pending the teacher&rsquo;s review. <a href="/dashboard" className="text-maroon-mid hover:underline">Dashboard →</a></p>;
  if (alreadyApplied === 'active' || alreadyApplied === 'paused') return <p className="text-sm text-maroon">You&rsquo;re enrolled in this programme. <a href="/dashboard" className="text-maroon-mid hover:underline">Dashboard →</a></p>;

  if (!open) {
    return (
      <div>
        {alreadyApplied === 'declined' && <p className="text-sm text-muted-warm mb-2">A previous application wasn&rsquo;t accepted. You can apply again.</p>}
        <button onClick={() => setOpen(true)} className="btn-primary">Apply to this programme</button>
      </div>
    );
  }

  async function submit() {
    if (intent.trim().length < 20) { setError('Please write at least a couple of sentences (≥20 characters).'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/enrollments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offeringId, intentText: intent.trim() }),
      });
      if (res.status === 401) { router.push(`/login?returnTo=/offerings/${offeringId}`); return; }
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.push('/dashboard?applied=1');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-line bg-parchment p-4 space-y-3">
      <label className="block">
        <span className="text-sm text-ink">Your note to the teacher</span>
        <span className="block text-xs text-muted-warm mb-1">What have you studied, where are you now, and what do you hope to learn on this path?</span>
        <textarea value={intent} onChange={(e) => setIntent(e.target.value)} rows={5}
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Sending…' : 'Send application'}</button>
        <button onClick={() => { setOpen(false); setError(null); }} className="text-sm text-muted-warm hover:text-maroon-mid">Cancel</button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
