'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Slot {
  startISO: string;
  endISO: string;
  label: string;
  durationMinutes: number;
}

export function SlotPicker({
  teacherId,
  slots,
  isTrial,
}: {
  teacherId: string;
  slots: Slot[];
  isTrial: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Group slots by date (yyyy-mm-dd of local day)
  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const dt = new Date(s.startISO);
      const key = dt.toISOString().slice(0, 10);
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return Array.from(m.entries()).map(([key, items]) => {
      const d = new Date(items[0].startISO);
      return {
        key,
        label: d.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        }),
        items,
      };
    });
  }, [slots]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId,
          scheduledAt: selected,
          isTrial,
          notesToTeacher: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Booking failed (HTTP ${res.status})`);
      }
      router.push('/dashboard?booked=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="space-y-6">
        {byDay.map((day) => (
          <div key={day.key}>
            <h3 className="font-display text-lg text-maroon mb-2">{day.label}</h3>
            <div className="flex flex-wrap gap-2">
              {day.items.map((s) => {
                const isSel = selected === s.startISO;
                const time = new Date(s.startISO).toLocaleTimeString('en-IN', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });
                return (
                  <button
                    key={s.startISO}
                    onClick={() => setSelected(s.startISO)}
                    className={`px-4 py-2 rounded border text-sm transition-colors ${
                      isSel
                        ? 'bg-maroon-mid text-parchment border-maroon-mid'
                        : 'bg-parchment border-line text-ink hover:border-maroon-mid'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="mt-8 bg-parchment-2 border border-line rounded-lg p-5">
          <label className="block">
            <span className="text-sm text-ink">Note to your teacher (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="What would you like to focus on? Any context that would help your guru prepare."
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
            />
          </label>

          <div className="mt-4 flex items-center gap-4">
            <button onClick={submit} disabled={submitting} className="btn-primary disabled:opacity-60">
              {submitting ? 'Requesting…' : isTrial ? 'Request free trial' : 'Request session (1 credit)'}
            </button>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-muted-warm hover:text-maroon-mid"
            >
              Change slot
            </button>
          </div>

          {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        </div>
      )}
    </div>
  );
}
