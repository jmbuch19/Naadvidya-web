'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type FileType = 'audio' | 'pdf' | 'image' | 'text';

interface ExistingFile {
  id: string;
  label: string | null;
  fileName: string;
  fileType: FileType;
  url: string | null;       // presigned read URL (or null if R2 down)
}

interface Props {
  assignmentId: string;
  deliverables: string[];
  submissionId: string | null;
  status: 'draft' | 'submitted' | 'reviewed' | null;
  existingFiles: ExistingFile[];
  r2Configured: boolean;
}

export function SubmissionWorkspace({
  assignmentId,
  deliverables,
  submissionId: initialSubmissionId,
  status,
  existingFiles,
  r2Configured,
}: Props) {
  const router = useRouter();
  const [submissionId, setSubmissionId] = useState(initialSubmissionId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const readOnly = status === 'submitted' || status === 'reviewed';
  const filesByLabel: Record<string, ExistingFile[]> = {};
  for (const f of existingFiles) {
    const key = f.label ?? 'general';
    filesByLabel[key] = filesByLabel[key] ?? [];
    filesByLabel[key].push(f);
  }

  async function ensureSubmission(): Promise<string | null> {
    if (submissionId) return submissionId;
    try {
      const res = await fetch('/api/submissions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, action: 'draft' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      const j = await res.json();
      setSubmissionId(j.id);
      return j.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create submission');
      return null;
    }
  }

  async function uploadFile(label: string, file: File) {
    setError(null);
    setBusy(label);

    const subId = await ensureSubmission();
    if (!subId) { setBusy(null); return; }

    try {
      // 1. Get presigned URL
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'submission',
          submissionId: subId,
          label,
          contentType: file.type || 'application/octet-stream',
          fileSizeKb: Math.ceil(file.size / 1024),
        }),
      });
      if (!presignRes.ok) {
        const j = await presignRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Presign failed (${presignRes.status})`);
      }
      const { uploadUrl, key } = await presignRes.json();

      // 2. PUT directly to R2
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (HTTP ${putRes.status})`);
      }

      // 3. Finalize — write submission_files row
      const fileType: FileType =
        file.type.startsWith('audio/') ? 'audio'
        : file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('image/') ? 'image'
        : 'text';

      const finalRes = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: subId,
          key,
          fileName: file.name,
          fileType,
          fileSizeKb: Math.ceil(file.size / 1024),
          label,
        }),
      });
      if (!finalRes.ok) {
        const j = await finalRes.json().catch(() => ({}));
        throw new Error(j.error ?? `Finalize failed (${finalRes.status})`);
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  }

  async function submitAll() {
    if (!submissionId) {
      setError('Nothing to submit — upload at least one file first.');
      return;
    }
    if (!confirm('Submit your homework? You won\'t be able to add more files after this.')) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/submissions/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, action: 'submit' }),
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

  const labels = deliverables.length > 0 ? deliverables : ['Submission'];

  return (
    <div>
      {!r2Configured && (
        <div className="rounded-lg border border-gold/40 bg-parchment-2 p-4 mb-6 text-sm">
          File storage (Cloudflare R2) isn&rsquo;t configured. The upload buttons below will
          fail until <code className="text-xs">R2_*</code> env vars are set.
        </div>
      )}

      <div className="space-y-5">
        {labels.map((label) => {
          const filesHere = filesByLabel[label] ?? [];
          return (
            <div key={label} className="rounded-lg border border-line bg-parchment p-5">
              <h3 className="font-display text-lg text-maroon mb-3">{label}</h3>

              {filesHere.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {filesHere.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-parchment-2 text-muted-warm uppercase">
                        {f.fileType}
                      </span>
                      <span className="flex-1 truncate">{f.fileName}</span>
                      {f.fileType === 'audio' && f.url && (
                        <audio controls src={f.url} className="h-8" />
                      )}
                      {f.fileType !== 'audio' && f.url && (
                        <a href={f.url} target="_blank" rel="noreferrer" className="text-maroon-mid hover:underline text-xs">
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!readOnly && (
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <span className="px-3 py-1.5 rounded border border-maroon-mid text-maroon-mid text-sm hover:bg-maroon-mid hover:text-parchment">
                    {busy === label ? 'Uploading…' : filesHere.length > 0 ? 'Add another' : 'Choose file'}
                  </span>
                  <input
                    type="file"
                    accept="audio/*,application/pdf,image/*,text/plain"
                    className="hidden"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(label, f);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-700 mt-4">{error}</p>}

      {!readOnly && (
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={submitAll}
            disabled={submitting || !submissionId}
            className="btn-primary disabled:opacity-60"
            title={!submissionId ? 'Upload at least one file first' : ''}
          >
            {submitting ? 'Submitting…' : 'Submit all'}
          </button>
          <p className="text-xs text-muted-warm">
            Once submitted, you can&rsquo;t edit. Make sure all files are uploaded first.
          </p>
        </div>
      )}
    </div>
  );
}
