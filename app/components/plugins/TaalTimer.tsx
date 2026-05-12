'use client';

import { useEffect, useRef, useState } from 'react';

// Taal-aware practice timer (Layakari Wheel). Visual matra counter with Sam highlighted
// and vibhag (section) boundaries; synthesised click — a brighter accent on Sam, a
// muted click on khali (empty) beats. BPM presets for Vilambit / Madhya / Drut + a slider.
//
// Self-contained: Web Audio for the click, no DB, no network.

interface Taal {
  name: string;
  matras: number;
  vibhags: number[];     // matras per vibhag, sums to `matras`
  khali: number[];       // 1-indexed matras that are "khali" (besides treatment of sam)
}

const TAALS: Taal[] = [
  { name: 'Teentaal', matras: 16, vibhags: [4, 4, 4, 4], khali: [9] },
  { name: 'Ektaal', matras: 12, vibhags: [2, 2, 2, 2, 2, 2], khali: [3, 11] },
  { name: 'Jhaptaal', matras: 10, vibhags: [2, 3, 2, 3], khali: [6] },
  { name: 'Rupak', matras: 7, vibhags: [3, 2, 2], khali: [1] }, // Rupak's sam is khali
  { name: 'Dadra', matras: 6, vibhags: [3, 3], khali: [4] },
  { name: 'Keherwa', matras: 8, vibhags: [4, 4], khali: [5] },
];

const TEMPO_PRESETS = [
  { label: 'Vilambit', bpm: 50 },
  { label: 'Madhya', bpm: 100 },
  { label: 'Drut', bpm: 200 },
];

// Which matras start a new vibhag (1-indexed)
function vibhagStarts(t: Taal): Set<number> {
  const s = new Set<number>();
  let acc = 1;
  for (const v of t.vibhags) { s.add(acc); acc += v; }
  return s;
}

export function TaalTimer() {
  const [taalIdx, setTaalIdx] = useState(0);
  const [bpm, setBpm] = useState(100);
  const [withSound, setWithSound] = useState(true);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0); // 0-indexed current matra (display)

  const taal = TAALS[taalIdx];
  const starts = vibhagStarts(taal);
  const khaliSet = new Set(taal.khali);

  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const nextTickRef = useRef(0);
  const matraRef = useRef(0);

  const cfg = useRef({ taalIdx, bpm, withSound });
  useEffect(() => { cfg.current = { taalIdx, bpm, withSound }; }, [taalIdx, bpm, withSound]);

  function click(ctx: AudioContext, when: number, kind: 'sam' | 'beat' | 'khali') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const freq = kind === 'sam' ? 1320 : kind === 'khali' ? 520 : 880;
    const peak = kind === 'sam' ? 0.6 : kind === 'khali' ? 0.18 : 0.3;
    o.type = 'square';
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(when); o.stop(when + 0.1);
  }

  function tickKind(matra1: number): 'sam' | 'beat' | 'khali' {
    if (matra1 === 1 && !TAALS[cfg.current.taalIdx].khali.includes(1)) return 'sam';
    if (TAALS[cfg.current.taalIdx].khali.includes(matra1)) return 'khali';
    return 'beat';
  }

  function scheduleLoop() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const lookahead = 0.2;
    const secPerBeat = 60 / cfg.current.bpm;
    const t = TAALS[cfg.current.taalIdx];
    while (nextTickRef.current < ctx.currentTime + lookahead) {
      const matra0 = matraRef.current % t.matras;
      const matra1 = matra0 + 1;
      if (cfg.current.withSound) click(ctx, nextTickRef.current, tickKind(matra1));
      // schedule the visual update
      const delayMs = Math.max(0, (nextTickRef.current - ctx.currentTime) * 1000);
      const m = matra0;
      window.setTimeout(() => setCurrent(m), delayMs);
      matraRef.current = (matraRef.current + 1) % t.matras;
      nextTickRef.current += secPerBeat;
    }
  }

  function start() {
    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      ctxRef.current = ctx;
    }
    ctx.resume();
    matraRef.current = 0;
    setCurrent(0);
    nextTickRef.current = ctx.currentTime + 0.06;
    scheduleLoop();
    timerRef.current = window.setInterval(scheduleLoop, 60);
    setRunning(true);
  }

  function stop() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRunning(false);
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    ctxRef.current?.close().catch(() => {});
  }, []);

  // Lay out matras around a wheel
  const R = 92;
  const cx = 120, cy = 120;
  const points = Array.from({ length: taal.matras }).map((_, i) => {
    const angle = -Math.PI / 2 + (i / taal.matras) * 2 * Math.PI;
    return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), matra1: i + 1 };
  });

  return (
    <div className="rounded-lg border border-line bg-parchment p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl text-maroon">Taal Timer</h3>
        <button
          onClick={running ? stop : start}
          className={`px-4 py-2 rounded font-medium ${running ? 'bg-maroon text-parchment' : 'bg-maroon-mid text-parchment hover:bg-maroon'}`}
        >
          {running ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <svg width="240" height="240" viewBox="0 0 240 240" className="shrink-0">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#E0D4B8" strokeWidth="1.5" />
          {points.map((p, i) => {
            const isCurrent = i === current && running;
            const isSam = p.matra1 === 1 && !khaliSet.has(1);
            const isVibhagStart = starts.has(p.matra1);
            const isKhali = khaliSet.has(p.matra1);
            const radius = isSam ? 13 : isVibhagStart ? 9 : 6;
            const fill = isCurrent
              ? (isSam ? '#C5A028' : isKhali ? '#7A6652' : '#8B1A1A')
              : (isSam ? '#C5A028' : isKhali ? '#E0D4B8' : isVibhagStart ? '#8B1A1A' : '#FAF3E0');
            const stroke = isCurrent ? '#2D0808' : '#8B1A1A';
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={radius} fill={fill} stroke={stroke} strokeWidth={isCurrent ? 2.5 : 1} />
                <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fill={isCurrent || isSam ? '#FAF3E0' : '#7A6652'}>
                  {isSam ? 'x' : p.matra1}
                </text>
              </g>
            );
          })}
          <text x={cx} y={cy - 4} textAnchor="middle" className="font-display" fontSize="20" fill="#8B1A1A">{taal.name}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#7A6652">{taal.matras} matras</text>
        </svg>

        <div className="flex-1 space-y-4 text-sm w-full">
          <div>
            <span className="text-ink">Taal</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {TAALS.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => { setTaalIdx(i); if (running) { matraRef.current = 0; setCurrent(0); } }}
                  className={`px-2 py-1.5 rounded text-xs border text-left ${taalIdx === i ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line text-ink hover:border-maroon-mid'}`}
                >
                  {t.name} <span className="opacity-70">({t.matras})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-ink">Tempo: {bpm} BPM</span>
            <div className="mt-1 flex gap-1.5 mb-2">
              {TEMPO_PRESETS.map((p) => (
                <button key={p.label} onClick={() => setBpm(p.bpm)} className={`px-2 py-1 rounded text-xs border ${Math.abs(bpm - p.bpm) < 1 ? 'bg-maroon-mid text-parchment border-maroon-mid' : 'bg-parchment border-line text-ink hover:border-maroon-mid'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <input type="range" min={30} max={280} step={2} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-[#8B1A1A]" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withSound} onChange={(e) => setWithSound(e.target.checked)} />
            <span className="text-ink">Theka click ( <span className="text-gold">●</span> sam · <span className="text-maroon-mid">●</span> beat · <span className="text-muted-warm">●</span> khali )</span>
          </label>
        </div>
      </div>
    </div>
  );
}
