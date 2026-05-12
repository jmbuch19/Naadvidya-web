# NAADVIDYA — Voice Repo & In-App Plugins
## Addition to MASTER_SPEC.md | Phase 1.5

---

## 1. VOICE REPO — CONCEPT

The Voice Repo is a teacher's personal library of short reference recordings:
- 2–3 minutes per recording
- Uploaded async (not tied to a session)
- Accompanied by text notes
- Tagged by raga, taal, category, and level
- Streamed to students — never downloaded
- One recording per teacher is publicly visible on their profile page
- All others: gated to students who have booked ≥1 session with that teacher

This is the feature that keeps students on the platform between sessions.

---

## 2. VOICE REPO — DATABASE (Migration 021)

```sql
CREATE TABLE voice_repo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  raga              text,
  taal              text,
  category          text CHECK (category IN (
                      'demonstration',   -- teacher demonstrates a phrase/raga
                      'alankaar',        -- speed and pattern exercises
                      'bandish',         -- composition rendering
                      'taal_theka',      -- rhythm cycle demonstration
                      'pronunciation',   -- swara pronunciation reference
                      'improvisation',   -- raag vistar example
                      'correction',      -- "here's what it should sound like"
                      'general'
                    )),
  level_min         integer DEFAULT 0,
  level_max         integer DEFAULT 7,
  file_url          text NOT NULL,   -- R2 presigned base path (not direct URL)
  file_key          text NOT NULL,   -- R2 object key
  file_size_kb      integer,
  duration_seconds  integer,
  notes_text        text,            -- accompanying written notes
  notes_pdf_url     text,            -- optional notation PDF
  notes_pdf_key     text,
  collection_id     uuid REFERENCES voice_repo_collections(id),
  is_public_sample  boolean DEFAULT false,  -- one per teacher max
  is_active         boolean DEFAULT true,
  play_count        integer DEFAULT 0,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE TABLE voice_repo_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,   -- e.g. "Yaman Series", "Taal Basics"
  description text,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE voice_repo ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_repo_collections ENABLE ROW LEVEL SECURITY;

-- Public sample: visible to all
CREATE POLICY "Public samples visible to everyone"
  ON voice_repo FOR SELECT
  USING (is_public_sample = true AND is_active = true);

-- Non-public: visible only to students who have booked this teacher
CREATE POLICY "Gated recordings visible to booked students"
  ON voice_repo FOR SELECT
  USING (
    teacher_id IN (
      SELECT tp.id FROM teacher_profiles tp
      JOIN bookings b ON b.teacher_id = tp.id
      WHERE b.student_id = auth.uid()
      AND b.status IN ('confirmed', 'completed')
    )
    OR
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

-- Teachers manage their own
CREATE POLICY "Teachers manage own voice repo"
  ON voice_repo FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

-- Admin sees all
CREATE POLICY "Admin sees all voice repo"
  ON voice_repo FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));
```

---

## 3. VOICE REPO — ACCESS RULES

```
Teacher uploads recording
  → Stored in R2 under: voice-repo/{teacherId}/{recordingId}.mp3
  → File key stored in DB
  → is_public_sample = false by default

Student opens teacher's Voice Repo page
  → Check: has student booked ≥1 session with this teacher?
    YES → fetch presigned stream URL (1hr expiry)
    NO  → show locked cards with "Book a session to access this library"
          Exception: is_public_sample = true → always visible

Audio player
  → Custom HTML5 <audio> player (no download attribute, no controls that expose src)
  → URL fetched server-side, injected into player at play time
  → Never exposed in DOM or browser dev tools as a plain R2 URL
  → Playback is streaming only — no seek-to-beginning-and-download trick

Play count
  → Increment voice_repo.play_count on each play server-side
  → Teacher sees play count per recording in dashboard
  → Interesting data: "Yaman Demo" played 47 times = most-referenced recording
```

---

## 4. VOICE REPO — TEACHER UI

### Upload flow
1. Teacher clicks "Add Recording"
2. Record in-browser (Web Audio API) OR upload a file (MP3/M4A/WAV)
3. Title, category, raga/taal tags, level range
4. Write accompanying notes (rich text editor — basic formatting only)
5. Optionally upload notation PDF
6. Choose or create a collection
7. Toggle "Make this my public sample" (disabled if another recording is already set as public sample)
8. Submit → upload to R2 → record in DB → live immediately

### Student-facing player (on teacher's profile and student dashboard)
- Clean card per recording: Title + category tag + duration + raga tag
- Play/pause button — waveform visualiser (CSS animation, not real waveform)
- Accompanying notes beneath player (collapsible)
- PDF notes download button if attached
- No download button for the audio

---

## 5. IN-APP PLUGINS — EVALUATED

### ✅ RECOMMENDED — Phase 1.5

**Plugin 1: Tanpura Player**
The single most essential tool in Indian Classical music practice.
Every student needs it. Every session uses it.

- Web Audio API oscillator, tuned to Sa, Pa, Sa' (standard tanpura strings)
- Pitch selector: C, C#, D, D#, E, F, F#, G, G#, A, A#, B (chromatic)
- Fine tune: ±50 cents
- Speed control (string stroke rate)
- Runs in background while student practices or takes notes
- Builds as a simple PWA widget inside the platform
- No external API, no cost, no latency
- **Phase 1.5 — Build this. No debate.**

**Plugin 2: Taal Timer (Layakari Wheel)**
Not just a metronome. A taal-aware practice tool.

- Select taal: Teen Taal (16), Ektaal (12), Jhaptaal (10), Rupak (7), Dadra (6), Keherwa (8)
- Visual matra counter (shows current beat in the cycle)
- Sam highlighted (beat 1 — the anchor)
- BPM control: Vilambit / Madhya / Drut (slow/medium/fast)
- Optional theka sound (hand-clap sample or tabla stroke sample)
- Simple, clean, no frills
- **Phase 1.5 — Build this. No debate.**

---

### ⚠️ CONSIDER CAREFULLY — Phase 2

**Plugin 3: Raga Reference Library**
A structured searchable database of ragas:
- Aaroh, Avaroh, Vadi, Samvadi
- Time of performance, season, mood
- Sample recordings from the Voice Repo linked inline
- Teachers can annotate with their own notes (per-student or global)

Confrontation: This is a content problem more than a tech problem.
Building the UI is easy. Populating it with accurate raga data for 200+ ragas
is a significant editorial effort. Who maintains it? Amee? A curated external source?
Decide ownership before building. Otherwise it launches empty and looks bad.

**Plugin 4: Practice Logger**
Student logs daily practice: what they practiced, how long, self-assessment notes.
Teacher can see the log before each session.

Good idea. Low tech complexity. Builds accountability.
BUT — only valuable if students actually use it. Do not build until you have
10 students who ask for it. Features nobody uses are weight, not value.

---

### ❌ DO NOT BUILD — These sound good but aren't

**Pitch Detector (microphone-based)**
Student sings into mic, app tells them if they're on pitch.

Reason to skip: Web Audio API pitch detection is unreliable on mobile Safari
(where most students will be). False negatives discourage learners.
The Indian scale's microtones (komal, tivra) make standard pitch detection
algorithms wrong. A "you're off" message from a broken detector is worse
than no detector. This is a dedicated hardware/app problem (use a shruti box
or a tuner app). Don't build it.

**In-app Notation Editor**
Teacher creates swarlipi (Indian notation) digitally inside the app.

Reason to skip: Bhatkhande and Vishnu Digambar swarlipi require custom
Unicode rendering or SVG generation. No standard web font covers this.
This is a 3-month engineering project for a feature that a PDF upload already
solves adequately. Teachers upload notation as PDF — done.

**AI Raga Suggester (Claude API)**
"Based on your level and what you've learned, here's your next raga."

Reason to skip for now: Raga progression in Indian Classical music is deeply
personal and Gharana-specific. An AI making this call without deep cultural
training will suggest wrong ragas. This offends serious practitioners.
It also undermines the Guru-Shishya relationship — Amee chose this platform
precisely because the teacher decides what the student learns next.
Do not automate this. Ever.

---

## 6. PLUGIN TECHNICAL ARCHITECTURE

Both recommended plugins (Tanpura + Taal Timer) should be built as:

- Self-contained React components in `/components/plugins/`
- Accessible from a "Practice Tools" section in the student dashboard
- Accessible from a floating toolbar button on session pages
- State: local component state only (no DB, no server calls)
- Mobile-friendly: large touch targets, works on iOS Safari

```
/components/plugins/
  TanpuraPlayer.tsx     ← Web Audio API oscillators
  TaalTimer.tsx         ← BPM counter + visual matra wheel
  PluginShelf.tsx       ← Container that renders available plugins
```

Plugin shelf appears in:
- Student dashboard → "Practice Tools" tab
- During a live session → floating "🎵 Tools" button (opens as overlay)

---

## 7. WHAT THIS ADDS TO THE DOCUMENT FOLDER

Files to update:
- NAADVIDYA_MASTER_SPEC.md → add Migration 021 reference
- NAADVIDYA_CLAUDE_CODE_PROMPT.md → add voice_repo to Phase 1.5 build steps
- NAADVIDYA_MISSING_PIECES.md → mark Tanpura + Taal Timer as Phase 1.5 planned

New tables needed:
- voice_repo (Migration 021)
- voice_repo_collections (Migration 022)

R2 folder convention addition:
- voice-repo/{teacherId}/{uuid}.mp3   ← teacher recordings
- voice-repo/{teacherId}/{uuid}.pdf   ← accompanying notation PDFs
