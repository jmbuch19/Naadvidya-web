-- ============================================================
-- NAADVIDYA — Phase 1.5 Class Types migration bundle
-- Paste into Supabase SQL editor → Run. Run AFTER the Phase 1 bundle
-- (and after _COMBINED_PHASE_1.5_voicerepo.sql, though order between the two doesn't matter).
-- Adds: class_offerings, enrollments, scheduled_sessions, teacher_holidays, disputes, audit_logs
-- ============================================================

-- ==== 0015_class_offerings.sql ====

-- Migration 0015 — class_offerings (Phase 1.5, NAADVIDYA_CLASS_DESIGN.md)
-- A teacher's published Programme (Gurukul Path), Workshop (Riyaaz), or curated
-- Mehfil series. Amee approves visibility (is_visible), like teacher profiles.
--
-- Additions beyond the spec doc: start_date + session_schedule (jsonb array of ISO
-- datetimes) — the spec says "teacher publishes all session dates at workshop
-- creation", so we need somewhere to put them.

CREATE TABLE class_offerings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id            uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  offering_type         text NOT NULL CHECK (offering_type IN ('gurukul_path', 'riyaaz_workshop', 'mehfil_session')),
  title                 text NOT NULL,
  description           text,
  min_level             integer DEFAULT 0 CHECK (min_level BETWEEN 0 AND 7),
  max_level             integer DEFAULT 7 CHECK (max_level BETWEEN 0 AND 7),
  specialization        text,
  sessions_per_week     integer DEFAULT 2 CHECK (sessions_per_week BETWEEN 1 AND 7),
  total_sessions        integer CHECK (total_sessions IS NULL OR total_sessions > 0),  -- workshops & series; NULL for open-ended gurukul
  duration_weeks        integer CHECK (duration_weeks IS NULL OR duration_weeks > 0),
  price_per_session_inr numeric NOT NULL CHECK (price_per_session_inr >= 0),
  max_students          integer DEFAULT 1 CHECK (max_students >= 1),
  prerequisites         text,
  curriculum_outline    text,
  start_date            date,                       -- when the block begins (workshops)
  session_schedule      jsonb DEFAULT '[]'::jsonb,  -- array of ISO datetime strings (workshops)
  is_active             boolean DEFAULT true,
  is_visible            boolean DEFAULT false,
  approval_status       text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_note        text,
  approved_by           uuid REFERENCES profiles(id),
  approved_at           timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CHECK (max_level >= min_level)
);

CREATE INDEX class_offerings_teacher_idx ON class_offerings(teacher_id);
CREATE INDEX class_offerings_visible_idx ON class_offerings(offering_type) WHERE is_visible = true AND is_active = true;
CREATE INDEX class_offerings_pending_idx ON class_offerings(approval_status) WHERE approval_status = 'pending';

ALTER TABLE class_offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active visible offerings readable by all"
  ON class_offerings FOR SELECT
  USING ((is_visible = true AND is_active = true)
    OR teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Teachers create own offerings"
  ON class_offerings FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Teachers update own offerings"
  ON class_offerings FOR UPDATE
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Teachers delete own offerings"
  ON class_offerings FOR DELETE
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all offerings"
  ON class_offerings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE TRIGGER class_offerings_updated_at
  BEFORE UPDATE ON class_offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==== 0016_enrollments.sql ====

-- Migration 0016 — enrollments (Phase 1.5)
-- A student's enrolment in a class_offering. Workshop: status goes straight to 'active'
-- and credits are reserved. Gurukul: status starts 'pending' (student submits intent),
-- teacher accepts → 'active'.
--
-- Addition beyond the spec doc: intent_text — the "short written intent" a student
-- submits when applying for a Gurukul Path.

CREATE TABLE enrollments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id           uuid NOT NULL REFERENCES class_offerings(id),
  student_id            uuid NOT NULL REFERENCES profiles(id),
  teacher_id            uuid NOT NULL REFERENCES teacher_profiles(id),
  status                text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'paused', 'withdrawn', 'completed', 'declined')),
  intent_text           text,
  start_date            date,
  end_date              date,
  sessions_total        integer,
  sessions_completed    integer DEFAULT 0,
  credits_reserved      integer NOT NULL DEFAULT 0 CHECK (credits_reserved >= 0),
  withdrawal_date       date,
  withdrawal_reason     text,
  decline_reason        text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX enrollments_student_idx ON enrollments(student_id, status);
CREATE INDEX enrollments_teacher_idx ON enrollments(teacher_id, status);
CREATE INDEX enrollments_offering_idx ON enrollments(offering_id);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own enrollments"
  ON enrollments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own enrollments"
  ON enrollments FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own enrollments"
  ON enrollments FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers see their enrollments"
  ON enrollments FOR SELECT
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Teachers update their enrollments"
  ON enrollments FOR UPDATE
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all enrollments"
  ON enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE TRIGGER enrollments_updated_at
  BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==== 0017_scheduled_sessions.sql ====

-- Migration 0017 — scheduled_sessions (Phase 1.5)
-- Concrete session occurrences for an enrolment (Workshop / Gurukul). Mehfil sessions
-- continue to live in the `bookings` table; booking_id here is kept for forward-compat
-- per the spec but isn't used by the Phase 1 Mehfil flow.

CREATE TABLE scheduled_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid REFERENCES enrollments(id) ON DELETE CASCADE,
  booking_id          uuid REFERENCES bookings(id),
  teacher_id          uuid NOT NULL REFERENCES teacher_profiles(id),
  student_id          uuid NOT NULL REFERENCES profiles(id),
  scheduled_at        timestamptz NOT NULL,
  duration_minutes    integer DEFAULT 60 CHECK (duration_minutes IN (15, 30, 45, 60, 90)),
  session_number      integer,                  -- e.g. "Session 3 of 8"
  status              text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'completed', 'cancelled', 'rescheduled', 'no_show_student', 'no_show_teacher')),
  daily_room_name     text,
  daily_room_url      text,
  student_join_url    text,
  teacher_join_url    text,
  reschedule_count    integer DEFAULT 0,
  rescheduled_from    timestamptz,
  rescheduled_reason  text,
  completed_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX scheduled_sessions_enrollment_idx ON scheduled_sessions(enrollment_id, scheduled_at);
CREATE INDEX scheduled_sessions_student_idx ON scheduled_sessions(student_id, scheduled_at);
CREATE INDEX scheduled_sessions_teacher_idx ON scheduled_sessions(teacher_id, scheduled_at);
CREATE INDEX scheduled_sessions_upcoming_idx ON scheduled_sessions(scheduled_at) WHERE status = 'upcoming';

ALTER TABLE scheduled_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own sessions"
  ON scheduled_sessions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see their sessions"
  ON scheduled_sessions FOR SELECT
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Teachers update their sessions"
  ON scheduled_sessions FOR UPDATE
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all scheduled sessions"
  ON scheduled_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- ==== 0018_teacher_holidays.sql ====

-- Migration 0018 — teacher_holidays (Phase 1.5)
-- Days a teacher marks off. Bulk scheduling skips these. Students with upcoming
-- sessions on a marked date get notified (NAADVIDYA_SCHEDULING_HOLIDAY_POLICY.md).

CREATE TABLE teacher_holidays (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  holiday_date      date NOT NULL,
  reason            text,
  affects_students  boolean DEFAULT true,
  notified_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(teacher_id, holiday_date)
);

CREATE INDEX teacher_holidays_teacher_idx ON teacher_holidays(teacher_id, holiday_date);

ALTER TABLE teacher_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holidays readable by all"
  ON teacher_holidays FOR SELECT USING (true);

CREATE POLICY "Teachers manage own holidays"
  ON teacher_holidays FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all holidays"
  ON teacher_holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- ==== 0019_disputes.sql ====

-- Migration 0019 — disputes (Phase 1.5)
-- Raised by a student or teacher about a booking or enrolment. Amee resolves them.

CREATE TABLE disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by         uuid NOT NULL REFERENCES profiles(id),
  against           uuid REFERENCES profiles(id),
  booking_id        uuid REFERENCES bookings(id),
  enrollment_id     uuid REFERENCES enrollments(id),
  dispute_type      text NOT NULL CHECK (dispute_type IN ('no_show', 'quality', 'payment', 'harassment', 'technical', 'other')),
  description       text NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'escalated', 'closed')),
  resolution        text,
  resolved_by       uuid REFERENCES profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX disputes_status_idx ON disputes(status, created_at);
CREATE INDEX disputes_raised_by_idx ON disputes(raised_by);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties see their disputes"
  ON disputes FOR SELECT
  USING (raised_by = auth.uid() OR against = auth.uid());

CREATE POLICY "Anyone signed in can raise a dispute about themselves"
  ON disputes FOR INSERT WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Admin manages all disputes"
  ON disputes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==== 0020_audit_logs.sql ====

-- Migration 0020 — audit_logs (Phase 1.5)
-- Append-only trail of significant actions. Admin reads; the app inserts via the
-- service-role client. (No UI yet — Phase 1.5 Part 2 / Phase 2.)

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

CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads all audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- Inserts come from the service-role client (bypasses RLS) or any authenticated
-- session; never updated or deleted from the app.
CREATE POLICY "Authenticated can insert audit logs"
  ON audit_logs FOR INSERT WITH CHECK (true);
