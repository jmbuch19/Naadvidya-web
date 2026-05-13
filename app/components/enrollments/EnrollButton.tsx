'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Workshop / Mehfil-series enrolment. Reserves N credits and creates the scheduled
// sessions. If not signed in → redirect to login with returnTo.
export function EnrollButton({ offeringId, sessions, alreadyEnrolled }: { offeringId: string; sessions: number; alreadyEnrolled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyEnrolled) {
    return <div className="text-sm text-maroon">You&rsquo;re enrolled. <a href="/dashboard" className="text-maroon-mid hover:underline">Go to your dashboard →</a></div>;
  }

  async function enroll() {
    if (!confirm(`Enrol in this workshop? ${sessions} credit${sessions === 1 ? '' : 's'} will be reserved (1 per session) and all session dates locked in.`)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/enrollments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offeringId }),
      });
      if (res.status === 401) { router.push(`/login?returnTo=/offerings/${offeringId}`); return; }
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.push('/dashboard?enrolled=1');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
  }

  return (
    <div>
      <button onClick={enroll} disabled={busy} className="btn-primary disabled:opacity-60">
        {busy ? 'Enrolling…' : `Enrol — reserve ${sessions} credit${sessions === 1 ? '' : 's'}`}
      </button>
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
    </div>
  );
}
