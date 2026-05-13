'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Holiday { holiday_date: string; reason: string | null }

export function HolidayManager({ initial }: { initial: Holiday[] }) {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!date) { setError('Pick a date'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/teacher/holidays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, reason: reason.trim() || undefined }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      setDate(''); setReason(''); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }

  async function remove(d: string) {
    if (!confirm(`Remove the holiday on ${d}?`)) return;
    try {
      const res = await fetch(`/api/teacher/holidays?date=${encodeURIComponent(d)}`, { method: 'DELETE' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="block">
          <span className="text-sm text-ink">Date off</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 px-3 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" />
        </label>
        <label className="block flex-1 min-w-[200px]">
          <span className="text-sm text-ink">Reason (optional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Diwali · Personal travel" className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" />
        </label>
        <button onClick={add} disabled={busy} className="btn-primary !py-2 !px-4 text-sm disabled:opacity-60">{busy ? 'Adding…' : 'Add holiday'}</button>
      </div>
      {error && <p className="text-sm text-red-700 mb-3">{error}</p>}

      {initial.length === 0 ? (
        <p className="text-sm text-muted-warm">No holidays marked. Bulk scheduling will use every day in the range.</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-lg bg-parchment overflow-hidden">
          {initial.map((h) => (
            <li key={h.holiday_date} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                <span className="text-ink font-medium">{new Date(h.holiday_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {h.reason && <span className="text-muted-warm"> — {h.reason}</span>}
              </span>
              <button onClick={() => remove(h.holiday_date)} className="text-xs text-muted-warm hover:text-red-700">Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
