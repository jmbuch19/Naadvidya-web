'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  profileId: string;
  fullName: string;
  currentRole: 'student' | 'teacher';
}

export function ChangeRoleButton({ profileId, fullName, currentRole }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = currentRole === 'student' ? 'teacher' : 'student';
  const verb = currentRole === 'student' ? 'Make teacher' : 'Demote to student';
  const warn =
    currentRole === 'student'
      ? `Promote ${fullName} to teacher? A pending teacher profile will be created — Amee still has to approve it.`
      : `Demote ${fullName} to student? Their teacher profile will be hidden from /teachers but kept for historical sessions.`;

  async function go() {
    if (!confirm(warn)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/profiles/${profileId}/change-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: target }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={go}
        disabled={busy}
        className="px-2 py-1 rounded border border-line text-xs text-muted-warm hover:border-maroon-mid hover:text-maroon-mid disabled:opacity-60"
      >
        {busy ? 'Working…' : verb}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
