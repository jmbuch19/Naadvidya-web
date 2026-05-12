'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Collection { id: string; title: string }

const CATEGORIES = [
  { v: 'demonstration', l: 'Demonstration — a phrase / raga shown' },
  { v: 'alankaar', l: 'Alankaar — speed & pattern exercise' },
  { v: 'bandish', l: 'Bandish — composition rendering' },
  { v: 'taal_theka', l: 'Taal / Theka — rhythm cycle' },
  { v: 'pronunciation', l: 'Pronunciation — swara reference' },
  { v: 'improvisation', l: 'Improvisation — raag vistar' },
  { v: 'correction', l: 'Correction — "here\'s what it should sound like"' },
  { v: 'general', l: 'General' },
];
const LEVELS = ['Praveshika (0)', 'Prarambhik I (1)', 'Prarambhik II (2)', 'Madhyama I (3)', 'Madhyama II (4)', 'Visharad I (5)', 'Visharad II (6)', 'Alankar+ (7)'];

async function presignAndPut(kind: 'audio' | 'pdf', file: File): Promise<string> {
  const presignRes = await fetch('/api/voice-repo/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, contentType: file.type || (kind === 'pdf' ? 'application/pdf' : 'audio/mpeg'), fileSizeKb: Math.ceil(file.size / 1024) }),
  });
  if (!presignRes.ok) {
    const j = await presignRes.json().catch(() => ({}));
    throw new Error(j.error ?? `Presign failed (${presignRes.status})`);
  }
  const { uploadUrl, key } = await presignRes.json();
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || (kind === 'pdf' ? 'application/pdf' : 'audio/mpeg') }, body: file });
  if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status})`);
  return key as string;
}

export function VoiceRepoUploadForm({ collections, hasPublicSample }: { collections: Collection[]; hasPublicSample: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [raga, setRaga] = useState('');
  const [taal, setTaal] = useState('');
  const [category, setCategory] = useState('general');
  const [levelMin, setLevelMin] = useState(0);
  const [levelMax, setLevelMax] = useState(7);
  const [notesText, setNotesText] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [newCollection, setNewCollection] = useState('');
  const [makePublic, setMakePublic] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!title.trim()) { setError('Title is required'); return; }
    if (!audioFile) { setError('Choose an audio file'); return; }
    if (levelMax < levelMin) { setError('Max level must be ≥ min level'); return; }
    setBusy(true);
    try {
      // Optionally create a new collection first
      let colId = collectionId || null;
      if (!colId && newCollection.trim()) {
        const r = await fetch('/api/voice-repo/collections', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newCollection.trim() }),
        });
        if (r.ok) { const j = await r.json(); colId = j.id; }
      }

      const fileKey = await presignAndPut('audio', audioFile);
      let notesPdfKey: string | null = null;
      if (pdfFile) notesPdfKey = await presignAndPut('pdf', pdfFile);

      // Estimate duration client-side (best effort)
      let durationSeconds: number | null = null;
      try {
        durationSeconds = await new Promise<number | null>((resolve) => {
          const a = document.createElement('audio');
          a.preload = 'metadata';
          a.onloadedmetadata = () => resolve(Math.round(a.duration) || null);
          a.onerror = () => resolve(null);
          a.src = URL.createObjectURL(audioFile);
        });
      } catch { /* ignore */ }

      const res = await fetch('/api/voice-repo/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description: description || null, raga: raga || null, taal: taal || null,
          category, levelMin, levelMax, notesText: notesText || null,
          fileKey, notesPdfKey, fileSizeKb: Math.ceil(audioFile.size / 1024), durationSeconds,
          collectionId: colId, makePublicSample: makePublic,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }
      router.refresh();
      // reset
      setTitle(''); setDescription(''); setRaga(''); setTaal(''); setCategory('general');
      setLevelMin(0); setLevelMax(7); setNotesText(''); setCollectionId(''); setNewCollection('');
      setMakePublic(false); setAudioFile(null); setPdfFile(null); setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="btn-primary">+ Add recording</button>;
  }

  return (
    <div className="rounded-lg border border-line bg-parchment p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-maroon">New recording</h3>
        <button onClick={() => setOpen(false)} className="text-sm text-muted-warm hover:text-maroon-mid">Cancel</button>
      </div>

      <label className="block">
        <span className="text-sm text-ink">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yaman — aaroh-avaroh, slow"
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <label className="block">
        <span className="text-sm text-ink">Audio file (MP3 / M4A / WAV)</span>
        <input type="file" accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm text-muted-warm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-maroon-mid file:bg-parchment file:text-maroon-mid" />
        {audioFile && <span className="block mt-1 text-xs text-muted-warm">{audioFile.name} · {(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>}
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-ink">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid">
            {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm text-ink">Level — from</span>
            <select value={levelMin} onChange={(e) => setLevelMin(Number(e.target.value))}
              className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid">
              {LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-ink">to</span>
            <select value={levelMax} onChange={(e) => setLevelMax(Number(e.target.value))}
              className="mt-1 w-full px-2 py-2 rounded border border-line bg-parchment text-sm focus:outline-none focus:border-maroon-mid">
              {LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-ink">Raga (optional)</span>
          <input value={raga} onChange={(e) => setRaga(e.target.value)} placeholder="Yaman"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
        </label>
        <label className="block">
          <span className="text-sm text-ink">Taal (optional)</span>
          <input value={taal} onChange={(e) => setTaal(e.target.value)} placeholder="Teentaal"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
        </label>
      </div>

      <label className="block">
        <span className="text-sm text-ink">Short description (optional)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Listen to the Ni-Re-Sa transition; keep it unhurried."
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <label className="block">
        <span className="text-sm text-ink">Notes (optional)</span>
        <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={3}
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid" />
      </label>

      <label className="block">
        <span className="text-sm text-ink">Notation PDF (optional)</span>
        <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm text-muted-warm file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-maroon-mid file:bg-parchment file:text-maroon-mid" />
        {pdfFile && <span className="block mt-1 text-xs text-muted-warm">{pdfFile.name}</span>}
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-ink">Add to collection (optional)</span>
          <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid">
            <option value="">— none —</option>
            {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-ink">…or new collection</span>
          <input value={newCollection} onChange={(e) => setNewCollection(e.target.value)} placeholder="Yaman Series" disabled={!!collectionId}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid disabled:opacity-50" />
        </label>
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} className="mt-1" />
        <span>
          <span className="text-sm text-ink">Make this my public sample</span>
          <span className="block text-xs text-muted-warm">
            Shown on your profile to prospective students. Only one recording can be your public sample
            {hasPublicSample ? ' — checking this replaces the current one.' : '.'}
          </span>
        </span>
      </label>

      <div className="flex items-center gap-4 pt-2 border-t border-line">
        <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">
          {busy ? 'Uploading…' : 'Add recording'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
