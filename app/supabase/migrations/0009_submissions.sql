-- Migration 0009 — submissions
-- One submission per assignment per student. Files attached via submission_files.

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX submissions_assignment_idx ON submissions(assignment_id);
CREATE INDEX submissions_status_idx ON submissions(status, submitted_at DESC);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own submissions"
  ON submissions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own submissions"
  ON submissions FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own submissions"
  ON submissions FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers see submissions for their assignments"
  ON submissions FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Teachers update submission status"
  ON submissions FOR UPDATE
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin manages all submissions"
  ON submissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
