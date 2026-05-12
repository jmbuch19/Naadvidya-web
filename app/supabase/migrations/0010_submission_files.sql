-- Migration 0010 — submission_files
-- One row per uploaded artifact (audio recording, PDF notes, image, text).
-- file_key is the R2 object key; file_url is the presigned read URL.
-- Files are private — re-generate presigned URLs on display.

CREATE TABLE submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'pdf', 'image', 'text')),
  file_url text NOT NULL,
  file_key text NOT NULL,
  file_name text NOT NULL,
  file_size_kb integer,
  label text,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX submission_files_submission_idx ON submission_files(submission_id);

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submission files visible to student and teacher"
  ON submission_files FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
    OR
    submission_id IN (
      SELECT s.id FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students upload their own files"
  ON submission_files FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Students delete their own files"
  ON submission_files FOR DELETE
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all submission files"
  ON submission_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
