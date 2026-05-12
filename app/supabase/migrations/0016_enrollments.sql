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
