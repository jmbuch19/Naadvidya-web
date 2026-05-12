'use client';

import { useEffect, useRef, useState } from 'react';

// Tanpura drone — Web Audio API. Synthesised plucked strings cycling Sa · Pa · Sa · Sa'
// with long decay envelopes so they overlap into a continuous shimmer. Not a sampled
// tanpura (no real jawari buzz), but a clean, latency-free pitch reference for practice.
//
// Self-contained: no DB, no network. State lives in this component.

const NOTE_FREQS: Record<string, number> = {
  // 4th octave (Hz). "Sa" can be set to any of these as the tonic.
  C: 261.63, 'C#': 277.18, D: 293.66, 'D#': 311.13, E: 329.63, F: 349.23,
  'F#': 369.99, G: 392.0, 'G#': 415.3, A: 440.0, 'A#': 466.16, B: 493.88,
};
const NOTES = Object.keys(NOTE_FREQS);

// String pattern: Pa (lower 5th) · Sa · Sa · Sa' (upper octave) — a common tanpura set.
// Ratios relative to the tonic Sa.
const STRINGS: { name: string; ratio: number }[] = [
  { name: 'Pa', ratio: 0.75 },   // perfect fifth below Sa (i.e. 3/2 down an octave)
  { name: 'Sa', ratio: 1 },
  { name: 'Sa', ratio: 1 },
  { name: "Sa'", ratio: 2 },
];

function centsToRatio(cents: number) {
  return Math.pow(2, cents / 1200);
}

export function TanpuraPlayer() {
  const [tonic, setTonic] = useState('C');
  const [fineCents, setFineCents] = useState(0);     // -50..+50
  const [speed, setSpeed] = useState(1.0);            // 0.5..2.0 — strokes per "unit"
  const [volume, setVolume] = useState(0.5);
  const [playing, setPlaying] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextTimeRef = useRef(0);
  const stringIdxRef = useRef(0);

  // Keep mutable copies for the scheduler closure
  const cfg = useRef({ tonic, fineCents, speed, volume });
  useEffect(() => { cfg.current = { tonic, fineCents, speed, volume }; }, [tonic, fineCents, speed, volume]);

  // Live-update master gain
  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.05);
    }
  }, [volume]);

  function pluck(ctx: AudioContext, master: GainNode, freq: number, when: number) {
    // A few harmonics for body; long decay so plucks overlap.
    const partials = [
      { mult: 1, gain: 0.55, type: 'sawtooth' as OscillatorType },
      { mult: 2, gain: 0.20, type: 'sine' as OscillatorType },
      { mult: 3, gain: 0.10, type: 'sine' as OscillatorType },
      { mult: 4, gain: 0.06, type: 'sine' as OscillatorType },
    ];
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.9, when + 0.02);   // fast attack
    env.gain.exponentialRampToValueAtTime(0.0008, when + 4.0);  // long decay
    env.connect(master);

    // gentle lowpass to soften
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400, when);
    lp.frequency.exponentialRampToValueAtTime(900, when + 3.5);
    lp.connect(env);

    partials.forEach((p) => {
      const o = ctx.createOscillator();
      o.type = p.type;
      o.frequency.setValueAtTime(freq * p.mult, when);
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.gain, when);
      o.connect(g);
      g.connect(lp);
      o.start(when);
      o.stop(when + 4.2);
    });
  }

  function scheduleLoop() {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const lookahead = 0.25; // seconds
    while (nextTimeRef.current < ctx.currentTime + lookahead) {
      const { tonic: t, fineCents: c, speed: s } = cfg.current;
      const base = NOTE_FREQS[t] * centsToRatio(c);
      const str = STRINGS[stringIdxRef.current % STRINGS.length];
      pluck(ctx, master, base * str.ratio, nextTimeRef.current);
      stringIdxRef.current = (stringIdxRef.current + 1) % STRINGS.length;
      // Interval between plucks: ~1.1s at speed 1.0, scaled inversely by speed.
      nextTimeRef.current += 1.1 / s;
    }
  }

  function start() {
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      ctxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = cfg.current.volume;
      master.connect(ctx.destination);
      masterRef.current = master;
    }
    ctx.resume();
    nextTimeRef.current = ctx.currentTime + 0.05;
    stringIdxRef.current = 0;
    scheduleLoop();
    schedulerRef.current = window.setInterval(scheduleLoop, 100);
    setPlaying(true);
  }

  function stop() {
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
    // Fade out master quickly
    const ctx = ctxRef.current, master = masterRef.current;
    if (ctx && master) {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      setTimeout(() => { master.gain.setTargetAtTime(cfg.current.volume, ctx.currentTime, 0.05); }, 400);
    }
    setPlaying(false);
  }

  useEffect(() => () => {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    ctxRef.current?.close().catch(() => {});
  }, []);

  return (
    <div className="rounded-lg border border-line bg-parchment p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl text-maroon">Tanpura</h3>
        <button
          onClick={playing ? stop : start}
          className={`px-4 py-2 rounded font-medium ${playing ? 'bg-maroon text-parchment' : 'bg-maroon-mid text-parchment hover:bg-maroon'}`}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <span className="text-ink">Sa (pitch)</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {NOTES.map((n) => (
              <button
                key={n}
                onClick={() => setTonic(n)}
                className={`px-2.5 py-1 rounded text-xs border ${tonic === n ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line text-ink hover:border-maroon-mid'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-ink">Fine tune: {fineCents > 0 ? '+' : ''}{fineCents} cents</span>
          <input type="range" min={-50} max={50} step={1} value={fineCents} onChange={(e) => setFineCents(Number(e.target.value))} className="w-full accent-[#8B1A1A]" />
        </label>

        <label className="block">
          <span className="text-ink">String speed: {speed.toFixed(1)}×</span>
          <input type="range" min={0.5} max={2} step={0.1} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-[#8B1A1A]" />
        </label>

        <label className="block">
          <span className="text-ink">Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-[#8B1A1A]" />
        </label>
      </div>

      <p className="mt-4 text-xs text-muted-warm">
        Pattern: Pa · Sa · Sa · Sa&rsquo;. Runs in the background — keep this tab open while you practise or take notes.
      </p>
    </div>
  );
}
