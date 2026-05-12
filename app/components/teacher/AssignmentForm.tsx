'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AssignmentForm({ bookingId, studentName }: { bookingId: string; studentName: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deliverableInput, setDeliverableInput] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([]);
  const [dueBefore, setDueBefore] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addDeliverable() {
    const v = deliverableInput.trim();
    if (!v) return;
    if (deliverables.includes(v)) return;
    setDeliverables([...deliverables, v]);
    setDeliverableInput('');
  }

  function removeDeliverable(i: number) {
    setDeliverables(deliverables.filter((_, j) => j !== i));
  }

  async function submit() {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/assignments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          title,
          description: description || null,
          deliverables,
          dueBefore: dueBefore ? new Date(dueBefore).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.push('/teacher/dashboard?assignment=1');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm text-ink">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Week 3 Practice — Yaman"
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>

      <label className="block">
        <span className="text-sm text-ink">What you want {studentName} to work on</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Practice the Yaman aaroh-avaroh slowly. Focus on Ni-Re-Sa transition. Listen to the bandish recording I shared and try to internalise the mukhda."
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>

      <div>
        <label className="block">
          <span className="text-sm text-ink">Deliverables</span>
          <span className="block text-xs text-muted-warm mb-2">
            What should {studentName} submit before your next session? Each one gets its own upload slot.
          </span>
          <div className="flex gap-2">
            <input
              value={deliverableInput}
              onChange={(e) => setDeliverableInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDeliverable(); } }}
              placeholder="e.g. Yaman recording (3 min)"
              className="flex-1 px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
            />
            <button
              type="button"
              onClick={addDeliverable}
              className="px-3 py-2 rounded border border-maroon-mid text-maroon-mid hover:bg-maroon-mid hover:text-parchment"
            >
              Add
            </button>
          </div>
        </label>
        {deliverables.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {deliverables.map((d, i) => (
              <li key={i} className="inline-flex items-center gap-2 bg-parchment-2 border border-line rounded-full px-3 py-1 text-sm">
                {d}
                <button
                  type="button"
                  onClick={() => removeDeliverable(i)}
                  className="text-muted-warm hover:text-red-700"
                  aria-label={`Remove ${d}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="block">
        <span className="text-sm text-ink">Submit before</span>
        <input
          type="datetime-local"
          value={dueBefore}
          onChange={(e) => setDueBefore(e.target.value)}
          className="mt-1 px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
        <span className="block mt-1 text-xs text-muted-warm">Usually the date of your next session.</span>
      </label>

      <div className="pt-2 flex items-center gap-4">
        <button onClick={submit} disabled={submitting} className="btn-primary disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post assignment'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
