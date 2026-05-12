-- Migration 0003 — teacher_availability
-- Recurring weekly slots. start_time/end_time stored in teacher's timezone (not UTC)
-- because "Tuesday 7pm IST" is a recurring local-time concept, not a UTC moment.

CREATE TABLE teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text DEFAULT 'Asia/Kolkata',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX teacher_availability_teacher_idx ON teacher_availability(teacher_id, is_active);

ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability readable by all"
  ON teacher_availability FOR SELECT USING (true);

CREATE POLICY "Teachers manage own availability"
  ON teacher_availability FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all availability"
  ON teacher_availability FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
