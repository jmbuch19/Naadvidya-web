-- Migration 0008 — assignments
-- Posted by teacher after a session. Linked to a booking. Deliverables is the list
-- of items the student must submit (each gets its own submission_file row).

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  student_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  description text,
  deliverables text[] DEFAULT '{}',
  due_before timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX assignments_student_idx ON assignments(student_id, due_before);
CREATE INDEX assignments_teacher_idx ON assignments(teacher_id, created_at DESC);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own assignments"
  ON assignments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see assignments they created"
  ON assignments FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers update own assignments"
  ON assignments FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all assignments"
  ON assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
