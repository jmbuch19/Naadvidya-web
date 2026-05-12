# NAADVIDYA — Class Design & Schema Additions
## Companion to MASTER_SPEC.md v1.0

---

## 1. THE THREE CLASS TYPES

### Type A — Gurukul Path (Progressive / Long-term)
- Teacher creates a **Programme** with level, curriculum outline, sessions/week, duration
- Student **enrolls** (not just books a session)
- Sessions are pre-scheduled in bulk on enrollment confirmation
- Credits are reserved for the full term at enrollment
- Homework is mandatory and tracked per session
- Progress tracked session-by-session
- Exit requires formal notice (see cancellation policy)
- **Phase:** 1.5

### Type B — Riyaaz Workshop (Fixed Scope / Short-term)
- Teacher creates a **Workshop** with topic, session count (4–12), start date, price
- Student joins before start date — no late entry
- Sessions pre-set, non-transferable
- Topic-complete at workshop end — no curriculum progression
- Good for diaspora students, holidaymakers, and casual learners
- **Phase:** 1.5

### Type C — Mehfil Session (Curated / Expert On-demand)
- Teacher or Amee creates a **Session** or short **Series** (1–5 sessions)
- Students book individually using credits
- Prerequisites stated on session page
- No enrollment, no long-term commitment
- **This is the Phase 1 model. Already designed in MASTER_SPEC.md.**
- **Phase:** 1 (complete)

---

## 2. MUSIC LEVEL TAXONOMY

| Level | Formal Name | Typical Duration | Mehfil Eligible |
|---|---|---|---|
| 0 | Praveshika (Entry) | 6–12 months | No |
| 1 | Prarambhik Pratham | 12 months | No |
| 2 | Prarambhik Dwitiya | 12 months | No |
| 3 | Madhyama Pratham | 12 months | Yes (limited) |
| 4 | Madhyama Dwitiya | 12 months | Yes |
| 5 | Visharad Pratham | 12–18 months | Yes (full) |
| 6 | Visharad Dwitiya | 12–18 months | Yes (full) |
| 7 | Alankar & Beyond | Open-ended | Yes (primary) |

**Platform brand levels:** Visharad I & II. Praveshika & Prarambhik available but not marketed.

---

## 3. NEW DB TABLES FOR PHASE 1.5

### Migration 015 — class_offerings
```sql
CREATE TABLE class_offerings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id          uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  offering_type       text NOT NULL CHECK (offering_type IN ('gurukul_path', 'riyaaz_workshop', 'mehfil_session')),
  title               text NOT NULL,
  description         text,
  min_level           integer DEFAULT 0 CHECK (min_level BETWEEN 0 AND 7),
  max_level           integer DEFAULT 7 CHECK (max_level BETWEEN 0 AND 7),
  specialization      text,         -- e.g. 'Hindustani Vocal', 'Tabla'
  sessions_per_week   integer DEFAULT 2,
  total_sessions      integer,      -- for workshops & series; NULL for gurukul
  duration_weeks      integer,      -- for workshops; NULL for gurukul
  price_per_session_inr numeric NOT NULL,
  max_students        integer DEFAULT 1,  -- 1 for 1:1; >1 for group workshops
  prerequisites       text,
  curriculum_outline  text,
  is_active           boolean DEFAULT true,
  is_visible          boolean DEFAULT false,  -- Amee approves visibility
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE class_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active offerings visible to all"
  ON class_offerings FOR SELECT
  USING (is_visible = true AND is_active = true OR teacher_id IN (
    SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
  ));

CREATE POLICY "Admin manages all offerings"
  ON class_offerings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));
```

### Migration 016 — enrollments
```sql
CREATE TABLE enrollments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id           uuid NOT NULL REFERENCES class_offerings(id),
  student_id            uuid NOT NULL REFERENCES profiles(id),
  teacher_id            uuid NOT NULL REFERENCES teacher_profiles(id),
  status                text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'paused', 'withdrawn', 'completed')),
  start_date            date NOT NULL,
  end_date              date,           -- NULL for open-ended gurukul
  sessions_total        integer,
  sessions_completed    integer DEFAULT 0,
  credits_reserved      integer NOT NULL,
  withdrawal_date       date,
  withdrawal_reason     text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own enrollments"
  ON enrollments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see their enrollments"
  ON enrollments FOR SELECT
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin sees all enrollments"
  ON enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));
```

### Migration 017 — scheduled_sessions
```sql
CREATE TABLE scheduled_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid REFERENCES enrollments(id),
  booking_id        uuid REFERENCES bookings(id),  -- for Mehfil (Phase 1)
  teacher_id        uuid NOT NULL REFERENCES teacher_profiles(id),
  student_id        uuid NOT NULL REFERENCES profiles(id),
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer DEFAULT 60,
  session_number    integer,   -- e.g. Session 3 of 8 in a workshop
  status            text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'completed', 'cancelled', 'rescheduled', 'no_show_student', 'no_show_teacher')),
  daily_room_name   text,
  student_join_url  text,
  teacher_join_url  text,
  reschedule_count  integer DEFAULT 0,
  rescheduled_from  timestamptz,
  rescheduled_reason text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own sessions"
  ON scheduled_sessions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see their sessions"
  ON scheduled_sessions FOR SELECT
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));
```

### Migration 018 — teacher_holidays
```sql
CREATE TABLE teacher_holidays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  holiday_date    date NOT NULL,
  reason          text,   -- optional: "Diwali", "Personal travel", etc.
  affects_students boolean DEFAULT true,   -- if false, teacher still available
  notified_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(teacher_id, holiday_date)
);

ALTER TABLE teacher_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holidays visible to enrolled students"
  ON teacher_holidays FOR SELECT USING (true);

CREATE POLICY "Teachers manage own holidays"
  ON teacher_holidays FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));
```

### Migration 019 — disputes
```sql
CREATE TABLE disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by         uuid NOT NULL REFERENCES profiles(id),
  against           uuid REFERENCES profiles(id),
  booking_id        uuid REFERENCES bookings(id),
  enrollment_id     uuid REFERENCES enrollments(id),
  dispute_type      text NOT NULL
    CHECK (dispute_type IN ('no_show', 'quality', 'payment', 'harassment', 'technical', 'other')),
  description       text NOT NULL,
  status            text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'escalated', 'closed')),
  resolution        text,
  resolved_by       uuid REFERENCES profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties see their disputes"
  ON disputes FOR SELECT
  USING (raised_by = auth.uid() OR against = auth.uid());

CREATE POLICY "Admin manages all disputes"
  ON disputes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));
```

### Migration 020 — audit_logs
```sql
CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id),
  actor_role    text,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads all audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE POLICY "System inserts only"
  ON audit_logs FOR INSERT WITH CHECK (true);
```

---

## 4. BOOKING FLOW BY CLASS TYPE

### Mehfil Session (Phase 1 — existing)
```
Student browses teachers → picks slot → credits deducted → teacher confirms →
Daily.co room created → session → assignment posted
```

### Riyaaz Workshop (Phase 1.5)
```
Teacher creates Workshop offering → Amee approves visibility →
Student enrolls → credits reserved for all sessions →
All sessions pre-scheduled → reminder emails 24hr before each →
Student joins each session → Workshop marked complete at final session
```

### Gurukul Path (Phase 1.5)
```
Teacher creates Programme → Amee approves →
Student applies (brief written intent required) →
Teacher accepts/declines student for their programme →
Enrollment confirmed → Term credits reserved →
First session scheduled → recurring weekly sessions auto-generated →
Each session: attend → homework assigned → submission → feedback →
Monthly progress review → term end: renew or graduate
```
