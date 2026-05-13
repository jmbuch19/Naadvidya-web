'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Initial {
  payout_method: 'upi' | 'bank' | null;
  upi_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
}

export function PayoutDetailsForm({ initial }: { initial: Initial | null }) {
  const router = useRouter();
  const [method, setMethod] = useState<'upi' | 'bank'>(initial?.payout_method ?? 'upi');
  const [upiId, setUpiId] = useState(initial?.upi_id ?? '');
  const [bankName, setBankName] = useState(initial?.bank_account_name ?? '');
  const [bankAcct, setBankAcct] = useState(initial?.bank_account_number ?? '');
  const [ifsc, setIfsc] = useState(initial?.bank_ifsc ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const body = method === 'upi'
        ? { payoutMethod: 'upi', upiId }
        : { payoutMethod: 'bank', bankAccountName: bankName, bankAccountNumber: bankAcct, bankIfsc: ifsc };
      const res = await fetch('/api/teacher/payout-details', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? `Failed (${res.status})`); }
      setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <fieldset className="flex gap-3">
        {(['upi', 'bank'] as const).map((m) => (
          <label key={m} className="flex flex-col p-3 rounded border border-line cursor-pointer hover:border-maroon-mid has-[input:checked]:border-maroon-mid has-[input:checked]:bg-parchment-2">
            <input type="radio" name="payoutMethod" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only peer" />
            <span className="font-display text-lg text-maroon">{m === 'upi' ? 'UPI' : 'Bank transfer'}</span>
            <span className="text-xs text-muted-warm">{m === 'upi' ? 'UPI ID (instant)' : 'Account number + IFSC'}</span>
          </label>
        ))}
      </fieldset>

      {method === 'upi' ? (
        <label className="block">
          <span className="text-sm text-ink">UPI ID</span>
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@oksbi"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
        </label>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-ink">Account holder name</span>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-ink">Account number</span>
              <input value={bankAcct} onChange={(e) => setBankAcct(e.target.value)} inputMode="numeric"
                className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
            </label>
            <label className="block">
              <span className="text-sm text-ink">IFSC</span>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" maxLength={11}
                className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Saving…' : 'Save payout details'}</button>
        {saved && <span className="text-sm text-gold">✓ Saved</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
      <p className="text-xs text-muted-warm">
        Naadvidya pays out manually on the 1st and 15th of every month. Minimum payout ₹500 — smaller
        balances roll over to the next cycle. Your details are visible only to you and to Amee.
      </p>
    </div>
  );
}
