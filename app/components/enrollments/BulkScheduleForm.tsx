'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Teacher generates recurring sessions for an active Gurukul enrolment. Reserves the
// student's credits (1/session) and skips the teacher's marked holidays.
export function BulkScheduleForm({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>([2, 4]); // Tue, Thu
  const [time, setTime] = useState('19:00');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));
  }

  async function submit() {
    setError(null); setResult(null);
    if (days.length === 0 || !time || !startDate || !endDate) { setError('Pick day(s), a time, and start/end dates.'); return; }
    if (!confirm('Create these sessions? The student\'s credits will be reserved — 1 per session.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/sessions/bulk-create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, daysOfWeek: days, time, startDate, endDate, durationMinutes: duration }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Failed (${res.status})`);
      const skipped = (j.skippedHolidays ?? []).length;
      setResult(`Created ${j.created} sessions${skipped ? ` (skipped ${skipped} holiday date${skipped === 1 ? '' : 's'})` : ''}.`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-sm px-3 py-1.5 rounded bg-gold/20 text-maroon hover:bg-gold/40">Set up / extend schedule</button>;
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-parchment-2/40 p-4 space-y-3">
      <p className="text-sm text-maroon font-medium">Generate recurring sessions</p>
      <div>
        <span className="text-sm text-ink">Day(s)</span>
        <div className="mt-1 flex gap-1.5">
          {DAYS.map((d, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              className={`px-2.5 py-1 rounded text-xs border ${days.includes(i) ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line hover:border-maroon-mid'}`}>{d}</button>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="block"><span className="text-sm text-ink">Time (IST)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" /></label>
        <label className="block"><span className="text-sm text-ink">From</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" /></label>
        <label className="block"><span className="text-sm text-ink">To</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid" /></label>
        <label className="block"><span className="text-sm text-ink">Minutes</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid">
            {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={busy} className="btn-primary !py-2 !px-4 text-sm disabled:opacity-60">{busy ? 'Creating…' : 'Create sessions'}</button>
        <button onClick={() => { setOpen(false); setError(null); setResult(null); }} className="text-sm text-muted-warm hover:text-maroon-mid">Done</button>
        {result && <p className="text-sm text-gold">{result}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
      <p className="text-xs text-muted-warm">Holidays you&rsquo;ve marked on the <a href="/teacher/holidays" className="text-maroon-mid hover:underline">Holidays</a> page are skipped automatically.</p>
    </div>
  );
}
