'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  kind: 'booking' | 'session';
  id: string;
  currentScheduledAt: string;            // ISO
  rescheduleCount: number;
  // Pending proposal state (all-or-nothing — either null or all set)
  proposedNewAt: string | null;
  proposalReason: string | null;
  isProposer: boolean;                   // true if caller initiated the pending proposal
}

const TZ = 'Asia/Kolkata';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: TZ,
  });
}

// Build a min datetime value (YYYY-MM-DDTHH:mm) that is 24h+ from now, IST.
function minDatetimeLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 1000); // +24h1m for safety
  // datetime-local expects local-zone wall clock. We render IST.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffsetMs);
  return ist.toISOString().slice(0, 16);
}

export function RescheduleControls(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAt, setNewAt] = useState('');
  const [reason, setReason] = useState('');

  const apiBase = props.kind === 'booking' ? `/api/bookings/${props.id}/reschedule` : `/api/sessions/${props.id}/reschedule`;

  const hasPending = !!props.proposedNewAt;

  async function propose() {
    if (!newAt || reason.trim().length < 5) {
      setError('Pick a new time (at least 24h from now) and write a short reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // datetime-local from input is in user's local zone. Convert to UTC ISO.
      const newAtUtc = new Date(newAt).toISOString();
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_scheduled_at: newAtUtc, reason: reason.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      setOpen(false);
      setReason('');
      setNewAt('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function respond(action: 'accept' | 'decline') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  // --- Render ---

  if (hasPending) {
    if (props.isProposer) {
      return (
        <div className="text-xs text-muted-warm">
          ⏳ Reschedule pending — awaiting other party. Proposed: <strong>{fmt(props.proposedNewAt!)}</strong>.
          {error && <p className="text-red-700 mt-1">{error}</p>}
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex-1 min-w-[200px]">
          <span className="text-muted-warm">Reschedule proposed:</span>{' '}
          <strong className="text-ink">{fmt(props.proposedNewAt!)}</strong>
          {props.proposalReason && <em className="block text-muted-warm mt-0.5">"{props.proposalReason}"</em>}
        </div>
        <button
          disabled={busy}
          onClick={() => respond('accept')}
          className="px-2 py-1 rounded bg-maroon-mid text-parchment hover:bg-maroon disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Accept'}
        </button>
        <button
          disabled={busy}
          onClick={() => respond('decline')}
          className="px-2 py-1 rounded border border-line text-muted-warm hover:border-red-500 hover:text-red-700 disabled:opacity-60"
        >
          Decline
        </button>
        {error && <p className="text-red-700 w-full mt-1">{error}</p>}
      </div>
    );
  }

  // No pending proposal — show "Reschedule" trigger unless already maxed out.
  if (props.rescheduleCount >= 1) {
    return <span className="text-xs text-muted-warm">No more reschedules available for this session.</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-maroon-mid hover:underline"
      >
        Reschedule
      </button>
    );
  }

  return (
    <div className="p-3 rounded border border-line bg-parchment-2/40 text-xs space-y-2 w-full">
      <p className="text-muted-warm">
        Current: <strong className="text-ink">{fmt(props.currentScheduledAt)}</strong>
      </p>
      <label className="block">
        <span className="text-muted-warm">New time (IST, at least 24h away):</span>
        <input
          type="datetime-local"
          value={newAt}
          min={minDatetimeLocal()}
          onChange={(e) => setNewAt(e.target.value)}
          className="mt-1 w-full px-2 py-1 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>
      <label className="block">
        <span className="text-muted-warm">Reason (visible to the other party):</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="E.g. clinic appointment came up at the same time."
          className="mt-1 w-full px-2 py-1 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={propose}
          className="px-3 py-1 rounded bg-maroon-mid text-parchment hover:bg-maroon disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Propose reschedule'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null); }}
          className="px-3 py-1 rounded border border-line text-muted-warm"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-700">{error}</p>}
    </div>
  );
}
