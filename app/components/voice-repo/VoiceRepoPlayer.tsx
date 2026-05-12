'use client';

import { useRef, useState } from 'react';

export interface VoiceRepoItem {
  id: string;
  title: string;
  description: string | null;
  raga: string | null;
  taal: string | null;
  category: string | null;
  level_min: number;
  level_max: number;
  duration_seconds: number | null;
  notes_text: string | null;
  notes_pdf_key: string | null;     // we never expose this directly; the page presigns it if it wants to offer a download
  notes_pdf_url: string | null;     // presigned PDF URL the server already generated (optional)
  is_public_sample: boolean;
  play_count?: number;              // only shown to the teacher
}

const CATEGORY_LABELS: Record<string, string> = {
  demonstration: 'Demonstration',
  alankaar: 'Alankaar',
  bandish: 'Bandish',
  taal_theka: 'Taal / Theka',
  pronunciation: 'Pronunciation',
  improvisation: 'Improvisation',
  correction: 'Correction',
  general: 'General',
};

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Streaming-only player. The R2 URL is fetched at play time from /api/voice-repo/[id]/play
// and assigned to a hidden <audio> element — never rendered into the DOM as a plain link,
// no download attribute. Not bulletproof against a determined user with devtools, but
// removes the casual download path and keeps play_count meaningful.
export function VoiceRepoPlayer({ item, showPlayCount }: { item: VoiceRepoItem; showPlayCount?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureUrl(): Promise<string | null> {
    if (loaded && audioRef.current?.src) return audioRef.current.src;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-repo/${item.id}/play`, { method: 'POST' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Couldn't load recording (${res.status})`);
      }
      const { streamUrl } = await res.json();
      setLoaded(true);
      return streamUrl as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Playback failed');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); return; }
    if (!el.src) {
      const url = await ensureUrl();
      if (!url) return;
      el.src = url;
    }
    try { await el.play(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not play'); }
  }

  return (
    <div className="rounded-lg border border-line bg-parchment p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? 'Pause' : 'Play'}
          className="shrink-0 w-11 h-11 rounded-full bg-maroon-mid text-parchment flex items-center justify-center hover:bg-maroon disabled:opacity-60"
        >
          {loading ? '…' : playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg>
          ) : (
            <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><path d="M1 1.3v13.4a1 1 0 0 0 1.5.86l11-6.7a1 1 0 0 0 0-1.72l-11-6.7A1 1 0 0 0 1 1.3z"/></svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg text-maroon">{item.title}</h3>
            {item.is_public_sample && (
              <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-gold/20 text-gold">Public sample</span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-warm">
            {item.category && <span>{CATEGORY_LABELS[item.category] ?? item.category}</span>}
            {item.raga && <span>राग {item.raga}</span>}
            {item.taal && <span>ताल {item.taal}</span>}
            {fmtDuration(item.duration_seconds) && <span>{fmtDuration(item.duration_seconds)}</span>}
            {showPlayCount && typeof item.play_count === 'number' && <span>· {item.play_count} {item.play_count === 1 ? 'play' : 'plays'}</span>}
          </div>

          {/* CSS "waveform" — purely decorative; animates while playing */}
          <div className={`mt-2 flex items-end gap-[3px] h-5 ${playing ? '' : 'opacity-40'}`} aria-hidden>
            {Array.from({ length: 32 }).map((_, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-maroon-mid/60"
                style={{
                  height: `${30 + Math.abs(Math.sin(i * 0.7)) * 70}%`,
                  animation: playing ? `vrwave 0.9s ease-in-out ${i * 0.03}s infinite alternate` : 'none',
                }}
              />
            ))}
          </div>

          {item.description && <p className="mt-2 text-sm text-ink">{item.description}</p>}

          {(item.notes_text || item.notes_pdf_url) && (
            <div className="mt-3">
              <button onClick={() => setNotesOpen((o) => !o)} className="text-xs text-maroon-mid hover:underline">
                {notesOpen ? 'Hide notes' : 'Show notes'}
              </button>
              {notesOpen && (
                <div className="mt-2 rounded border border-line bg-parchment-2 p-3 text-sm">
                  {item.notes_text && <p className="whitespace-pre-line text-ink">{item.notes_text}</p>}
                  {item.notes_pdf_url && (
                    <a href={item.notes_pdf_url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-maroon-mid hover:underline text-xs">
                      Open notation PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />

      <style>{`@keyframes vrwave { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }`}</style>
    </div>
  );
}
