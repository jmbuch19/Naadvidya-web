'use client';

import { useState, useEffect } from 'react';

interface Props {
  bookingId: string;
  roomUrl: string;
  isTeacher: boolean;
}

export function VideoRoom({ bookingId, roomUrl, isTeacher }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/daily/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setError(j.error ?? `Token fetch failed (${r.status})`);
          return;
        }
        setToken(j.token);
        if (j.mock) setMock(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Token fetch failed');
      });
    return () => { cancelled = true; };
  }, [bookingId]);

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
        <p className="text-muted-warm">
          Daily.co isn&rsquo;t configured yet (set <code className="text-xs bg-parchment px-1 rounded">DAILY_API_KEY</code> in <code className="text-xs bg-parchment px-1 rounded">.env.local</code>).
          You and your {isTeacher ? 'student' : 'guru'} would land here when both are
          ready to begin.
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center text-muted-warm">
        Preparing your session room…
      </div>
    );
  }

  const src = `${roomUrl}?t=${encodeURIComponent(token)}`;

  return (
    <iframe
      src={src}
      allow="camera; microphone; fullscreen; display-capture; autoplay"
      className="w-full rounded-lg border border-line"
      style={{ height: '600px' }}
      title="Naadvidya Session Room"
    />
  );
}
