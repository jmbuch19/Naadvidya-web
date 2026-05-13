'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface TeacherRow {
  bio: string | null;
  years_experience: number;
  sangeet_qualifications: string[];
  specializations: string[];
  ragas_taught: string[];
  languages: string[];
  gharana: string | null;
  gurus: string[];
  instruments: string[];
  student_levels: string[];
  session_fee_inr: number;
  intro_video_url: string | null;
  auto_confirm: boolean;
}

const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'] as const;

export function ProfileEditor({ initial }: { initial: TeacherRow }) {
  const router = useRouter();
  const [bio, setBio] = useState(initial.bio ?? '');
  const [years, setYears] = useState(String(initial.years_experience));
  const [fee, setFee] = useState(String(initial.session_fee_inr));
  const [introUrl, setIntroUrl] = useState(initial.intro_video_url ?? '');
  const [autoConfirm, setAutoConfirm] = useState(initial.auto_confirm);
  const [qualifications, setQualifications] = useState<string[]>(initial.sangeet_qualifications ?? []);
  const [specializations, setSpecializations] = useState<string[]>(initial.specializations ?? []);
  const [ragas, setRagas] = useState<string[]>(initial.ragas_taught ?? []);
  const [languages, setLanguages] = useState<string[]>(initial.languages ?? ['Hindi', 'English']);
  const [gharana, setGharana] = useState(initial.gharana ?? '');
  const [gurus, setGurus] = useState<string[]>(initial.gurus ?? []);
  const [instruments, setInstruments] = useState<string[]>(initial.instruments ?? []);
  const [studentLevels, setStudentLevels] = useState<string[]>(initial.student_levels ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/teacher/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          years_experience: Number(years) || 0,
          session_fee_inr: Number(fee) || 0,
          intro_video_url: introUrl || null,
          auto_confirm: autoConfirm,
          sangeet_qualifications: qualifications,
          specializations,
          ragas_taught: ragas,
          languages,
          gharana: gharana.trim() || null,
          gurus,
          instruments,
          student_levels: studentLevels,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm text-ink">Bio</span>
        <span className="block text-xs text-muted-warm mb-1">Minimum 150 words. This is what Amee reviews and what students read.</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Sangeet Visharad with 12 years of teaching. Lineage of the Gwalior gharana under Pandit X. Specializes in Khayal..."
          className="w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
        <span className="block mt-1 text-xs text-muted-warm">{bio.length} characters</span>
      </label>

      <div className="grid sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-sm text-ink">Years of experience</span>
          <input
            type="number"
            min={0}
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
        </label>

        <label className="block">
          <span className="text-sm text-ink">Fee per 60-min session (₹)</span>
          <input
            type="number"
            min={500}
            max={5000}
            step={50}
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
          <span className="block mt-1 text-xs text-muted-warm">Min ₹500. Recommended ₹700–₹1,500 for Madhyama/Visharad.</span>
        </label>
      </div>

      <ChipEditor
        label="Sangeet qualifications"
        hint="e.g. Sangeet Visharad · Sangeet Alankar"
        items={qualifications}
        onChange={setQualifications}
        placeholder="Sangeet Visharad"
      />

      <label className="block">
        <span className="text-sm text-ink">Gharana / lineage</span>
        <span className="block text-xs text-muted-warm mb-1">
          The school you belong to — e.g. Gwalior, Kirana, Patiala, Benaras, Jaipur-Atrauli. Leave blank if not applicable.
        </span>
        <input
          type="text"
          value={gharana}
          onChange={(e) => setGharana(e.target.value)}
          maxLength={120}
          placeholder="Gwalior gharana"
          className="w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
      </label>

      <ChipEditor
        label="Gurus you trained under"
        hint="Names of the teachers you studied with. Adds enormous credibility."
        items={gurus}
        onChange={setGurus}
        placeholder="Pandit Vinay Kumar"
      />

      <ChipEditor
        label="Instruments taught"
        hint="e.g. Voice · Tabla · Sitar · Harmonium. Keep this separate from style/specializations."
        items={instruments}
        onChange={setInstruments}
        placeholder="Voice"
      />

      <ChipEditor
        label="Specializations (style)"
        hint="e.g. Khayal · Thumri · Bhajan · Dhrupad. The style of music you teach."
        items={specializations}
        onChange={setSpecializations}
        placeholder="Khayal"
      />

      <div>
        <span className="block text-sm text-ink">Student levels you accept</span>
        <span className="block text-xs text-muted-warm mb-2">
          Tick all that apply. Helps students find the right fit.
        </span>
        <div className="flex flex-wrap gap-3">
          {LEVEL_OPTIONS.map((level) => {
            const checked = studentLevels.includes(level);
            return (
              <label
                key={level}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm ${
                  checked
                    ? 'bg-maroon-mid text-parchment border-maroon-mid'
                    : 'bg-parchment border-line text-ink hover:border-maroon-mid'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) setStudentLevels([...studentLevels, level]);
                    else setStudentLevels(studentLevels.filter((l) => l !== level));
                  }}
                />
                {level}
              </label>
            );
          })}
        </div>
      </div>

      <ChipEditor
        label="Ragas taught"
        hint="The ragas you can teach with depth."
        items={ragas}
        onChange={setRagas}
        placeholder="Yaman"
      />

      <ChipEditor
        label="Languages of instruction"
        items={languages}
        onChange={setLanguages}
        placeholder="Hindi"
      />

      <label className="block">
        <span className="text-sm text-ink">Intro video URL (optional)</span>
        <input
          type="url"
          value={introUrl}
          onChange={(e) => setIntroUrl(e.target.value)}
          placeholder="https://..."
          className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
        <span className="block mt-1 text-xs text-muted-warm">A 2-3 minute introduction. Strongly recommended.</span>
      </label>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoConfirm}
          onChange={(e) => setAutoConfirm(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="text-sm text-ink">Auto-confirm bookings within my available slots</span>
          <span className="block text-xs text-muted-warm">
            When on: bookings within your published availability are confirmed immediately and the
            Daily.co room is created. When off (default): you confirm each request manually within 24hr.
          </span>
        </span>
      </label>

      <div className="pt-2 flex items-center gap-4 border-t border-line">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {saved && <span className="text-sm text-gold">✓ Saved</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function ChipEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const v = input.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setInput('');
  }

  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }

  return (
    <div>
      <span className="block text-sm text-ink">{label}</span>
      {hint && <span className="block text-xs text-muted-warm mb-1">{hint}</span>}
      <div className="flex gap-2 mt-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
        />
        <button type="button" onClick={add} className="px-3 py-2 rounded border border-maroon-mid text-maroon-mid hover:bg-maroon-mid hover:text-parchment">
          Add
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li key={i} className="inline-flex items-center gap-1.5 bg-parchment-2 border border-line rounded-full px-2.5 py-1 text-sm">
              {it}
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it}`} className="text-muted-warm hover:text-red-700">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
