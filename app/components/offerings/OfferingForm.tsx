'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LEVELS, type OfferingType } from '@/lib/offerings';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function OfferingForm() {
  const router = useRouter();
  const [type, setType] = useState<OfferingType>('riyaaz_workshop');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [minLevel, setMinLevel] = useState(3);
  const [maxLevel, setMaxLevel] = useState(7);
  const [pricePerSession, setPricePerSession] = useState('900');
  const [maxStudents, setMaxStudents] = useState('1');
  const [prerequisites, setPrerequisites] = useState('');
  const [curriculum, setCurriculum] = useState('');
  // Workshop scheduling
  const [totalSessions, setTotalSessions] = useState('8');
  const [durationWeeks, setDurationWeeks] = useState('');
  const [sessionsPerWeek, setSessionsPerWeek] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState<number[]>([2]); // Tue
  const [time, setTime] = useState('19:00');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWorkshop = type === 'riyaaz_workshop';
  const isGurukul = type === 'gurukul_path';

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));
  }

  async function submit() {
    setError(null);
    if (!title.trim()) { setError('Title is required'); return; }
    if (maxLevel < minLevel) { setError('Max level must be ≥ min level'); return; }
    const price = Number(pricePerSession);
    if (!(price >= 0)) { setError('Enter a valid per-session price'); return; }
    if (isWorkshop) {
      if (!totalSessions || Number(totalSessions) < 1) { setError('Workshop needs a session count'); return; }
      if (!startDate || days.length === 0 || !time) { setError('Workshop needs a start date, recurring day(s), and a time'); return; }
    }
    setBusy(true);
    try {
      const res = await fetch('/api/offerings/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringType: type,
          title, description: description || null,
          minLevel, maxLevel,
          specialization: specialization || null,
          sessionsPerWeek: Number(sessionsPerWeek) || 1,
          totalSessions: totalSessions ? Number(totalSessions) : null,
          durationWeeks: durationWeeks ? Number(durationWeeks) : null,
          pricePerSessionInr: price,
          maxStudents: Number(maxStudents) || 1,
          prerequisites: prerequisites || null,
          curriculumOutline: curriculum || null,
          startDate: isWorkshop ? startDate : null,
          daysOfWeek: isWorkshop ? days : undefined,
          time: isWorkshop ? time : undefined,
        }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      router.push('/teacher/offerings?created=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed'); setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="text-sm text-ink">Format</span>
        <div className="mt-1 grid sm:grid-cols-3 gap-2">
          {([
            ['riyaaz_workshop', 'Riyaaz Workshop', 'Fixed scope, 4–12 sessions, set dates'],
            ['gurukul_path', 'Gurukul Path', 'Progressive curriculum, weekly, long-term'],
            ['mehfil_session', 'Mehfil Series', 'Short curated series, 1–5 sessions'],
          ] as [OfferingType, string, string][]).map(([v, name, sub]) => (
            <button
              key={v}
              type="button"
              onClick={() => setType(v)}
              className={`text-left p-3 rounded border ${type === v ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line hover:border-maroon-mid'}`}
            >
              <span className={`font-display text-base ${type === v ? 'text-parchment' : 'text-maroon'}`}>{name}</span>
              <span className={`block text-xs mt-0.5 ${type === v ? 'text-parchment/80' : 'text-muted-warm'}`}>{sub}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-ink">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isWorkshop ? 'Yaman in 8 Sessions' : 'Hindustani Vocal — Visharad Path'}
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <label className="block">
        <span className="text-sm text-ink">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-ink">Specialization</span>
          <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Hindustani Vocal · Khayal"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
        </label>
        <label className="block">
          <span className="text-sm text-ink">Per-session fee (₹)</span>
          <input type="number" min={0} step={50} value={pricePerSession} onChange={(e) => setPricePerSession(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          <span className="block mt-1 text-xs text-muted-warm">Students pay 1 credit per session; this is your fee per session for the payout calc.</span>
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <span className="text-sm text-ink">Level — from</span>
          <select value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))}
            className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid">
            {LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-ink">to</span>
          <select value={maxLevel} onChange={(e) => setMaxLevel(Number(e.target.value))}
            className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid">
            {LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-ink">Max students</span>
          <input type="number" min={1} value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          <span className="block mt-1 text-xs text-muted-warm">1 for 1:1; higher for group workshops.</span>
        </label>
      </div>

      {isWorkshop && (
        <div className="rounded-lg border border-line bg-parchment-2/40 p-4 space-y-4">
          <p className="text-sm text-maroon font-medium">Workshop schedule</p>
          <p className="text-xs text-muted-warm">Students see all session dates before enrolling — no late entry once it starts.</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-sm text-ink">Total sessions</span>
              <input type="number" min={1} max={24} value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
            </label>
            <label className="block">
              <span className="text-sm text-ink">Sessions / week</span>
              <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
            </label>
            <label className="block">
              <span className="text-sm text-ink">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
            </label>
          </div>
          <div>
            <span className="text-sm text-ink">Recurring day(s)</span>
            <div className="mt-1 flex gap-1.5">
              {DAYS.map((d, i) => (
                <button key={i} type="button" onClick={() => toggleDay(i)}
                  className={`px-2.5 py-1 rounded text-xs border ${days.includes(i) ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line hover:border-maroon-mid'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="block max-w-[180px]">
            <span className="text-sm text-ink">Time (IST)</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          </label>
        </div>
      )}

      {isGurukul && (
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-ink">Sessions / week</span>
            <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          </label>
          <label className="block">
            <span className="text-sm text-ink">Typical duration (weeks, optional)</span>
            <input type="number" min={1} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} placeholder="e.g. 52"
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          </label>
        </div>
      )}

      <label className="block">
        <span className="text-sm text-ink">Prerequisites (optional)</span>
        <input value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} placeholder="Comfortable with Yaman aaroh-avaroh; basic taal knowledge"
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <label className="block">
        <span className="text-sm text-ink">Curriculum outline (optional)</span>
        <textarea value={curriculum} onChange={(e) => setCurriculum(e.target.value)} rows={4} placeholder="Week 1: aaroh-avaroh & pakad. Week 2: chota khayal. Week 3: …"
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <div className="flex items-center gap-4 pt-2 border-t border-line">
        <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit for approval'}
        </button>
        <span className="text-xs text-muted-warm">Goes live once Amee approves it.</span>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
