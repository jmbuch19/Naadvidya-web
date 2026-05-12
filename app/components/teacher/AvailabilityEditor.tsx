'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SlotRow {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function trimSeconds(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}

export function AvailabilityEditor({ initial }: { initial: SlotRow[] }) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotRow[]>(() =>
    initial.map((s) => ({
      ...s,
      start_time: trimSeconds(s.start_time),
      end_time: trimSeconds(s.end_time),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<SlotRow>) {
    setSlots(slots.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  }

  function add() {
    setSlots([
      ...slots,
      { day_of_week: 1, start_time: '18:00', end_time: '19:00', timezone: 'Asia/Kolkata', is_active: true },
    ]);
  }

  function remove(i: number) {
    setSlots(slots.filter((_, j) => j !== i));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/teacher/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = slots.filter((s) => s.is_active).length;

  return (
    <div>
      <div className="rounded-lg border border-line bg-parchment overflow-hidden">
        {slots.length === 0 ? (
          <div className="p-6 text-center text-muted-warm text-sm">
            No slots configured. Add at least 4 per week to stay active.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {slots.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <select
                  value={s.day_of_week}
                  onChange={(e) => update(i, { day_of_week: Number(e.target.value) })}
                  className="px-2 py-1.5 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid"
                >
                  {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input
                  type="time"
                  value={s.start_time}
                  onChange={(e) => update(i, { start_time: e.target.value })}
                  className="px-2 py-1.5 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid"
                />
                <span className="text-muted-warm text-sm">→</span>
                <input
                  type="time"
                  value={s.end_time}
                  onChange={(e) => update(i, { end_time: e.target.value })}
                  className="px-2 py-1.5 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid"
                />
                <span className="text-xs text-muted-warm">IST</span>
                <label className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-warm">
                  <input type="checkbox" checked={s.is_active} onChange={(e) => update(i, { is_active: e.target.checked })} />
                  Active
                </label>
                <button onClick={() => remove(i)} className="ml-auto text-sm text-muted-warm hover:text-red-700">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={add} className="btn-ghost !py-2 !px-4 text-sm">+ Add slot</button>
        <span className={`text-sm ${activeCount < 4 ? 'text-red-700' : 'text-muted-warm'}`}>
          {activeCount} active slot{activeCount === 1 ? '' : 's'}
          {activeCount < 4 && ' · need 4+ to stay active'}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-4 pt-4 border-t border-line">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : 'Save availability'}
        </button>
        {saved && <span className="text-sm text-gold">✓ Saved</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}
