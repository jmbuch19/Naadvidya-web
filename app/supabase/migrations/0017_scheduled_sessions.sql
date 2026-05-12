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
