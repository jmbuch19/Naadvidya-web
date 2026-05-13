'use client';

import { useEffect, useState } from 'react';

// Like VideoRoom, but for a scheduled_session: fetches { token, roomUrl } from
// /api/sessions/[id]/daily-token (which lazily creates the Daily.co room).
export function ScheduledVideoRoom({ sessionId, isTeacher }: { sessionId: string; isTeacher: boolean }) {
  const [state, setState] = useState<{ token: string; roomUrl: string } | null>(null);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${sessionId}/daily-token`, { method: 'POST' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) { setError(j.error ?? `Couldn't start the session room (${r.status})`); return; }
        if (j.mock) { setMock(true); return; }
        setState({ token: j.token, roomUrl: j.roomUrl });
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed'); });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-800">
        <p className="font-semibold">Could not start the session room</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }
  if (mock) {
    return (
      <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center">
        <p className="font-display text-2xl text-maroon mb-2">Mock session room</p>
        <p className="text-muted-warm">Daily.co isn&rsquo;t configured (set <code className="text-xs bg-parchment px-1 rounded">DAILY_API_KEY</code>). You and your {isTeacher ? 'student' : 'guru'} would land here when both are ready.</p>
      </div>
    );
  }
  if (!state) {
    return <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center text-muted-warm">Preparing your session room…</div>;
  }

  return (
    <iframe
      src={`${state.roomUrl}?t=${encodeURIComponent(state.token)}`}
      allow="camera; microphone; fullscreen; display-capture; autoplay"
      className="w-full rounded-lg border border-line"
      style={{ height: '600px' }}
      title="Naadvidya Session Room"
    />
  );
}
