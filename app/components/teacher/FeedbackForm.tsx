'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FeedbackForm({ submissionId, r2Configured }: { submissionId: string; r2Configured: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [audioKey, setAudioKey] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadAudio(file: File) {
    setError(null);
    setUploading(true);
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'feedback',
          submissionId,
          label: 'feedback-audio',
          contentType: file.type || 'audio/webm',
          fileSizeKb: Math.ceil(file.size / 1024),
        }),
      });
      if (!presignRes.ok) {
        const j = await presignRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Presign failed (${presignRes.status})`);
      }
      const { uploadUrl, key } = await presignRes.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'audio/webm' },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (HTTP ${putRes.status})`);

      setAudioKey(key);
      setAudioName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audio upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!text.trim() && !audioKey) {
      setError('Add text feedback or an audio note before posting.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          feedbackText: text.trim() || null,
          feedbackAudioKey: audioKey,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-parchment p-5">
      <label className="block">
        <span className="text-sm text-ink">Text feedback</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Specific, constructive, kind. One-word feedback isn't acceptable here — speak as a guru."
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>

      <div className="mt-5">
        <p className="text-sm text-ink mb-1">Audio note (optional)</p>
        {!r2Configured && (
          <p className="text-xs text-muted-warm mb-2">
            R2 not configured — audio note upload will fail until <code>R2_*</code> env vars are set.
          </p>
        )}
        {audioKey ? (
          <p className="text-sm text-muted-warm">
            ✓ Audio attached: {audioName}{' '}
            <button
              type="button"
              onClick={() => { setAudioKey(null); setAudioName(null); }}
              className="text-maroon-mid hover:underline ml-2"
            >
              Remove
            </button>
          </p>
        ) : (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="px-3 py-1.5 rounded border border-maroon-mid text-maroon-mid text-sm hover:bg-maroon-mid hover:text-parchment">
              {uploading ? 'Uploading…' : 'Choose audio file'}
            </span>
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAudio(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button onClick={submit} disabled={submitting} className="btn-primary disabled:opacity-60">
          {submitting ? 'Posting…' : 'Post feedback'}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
