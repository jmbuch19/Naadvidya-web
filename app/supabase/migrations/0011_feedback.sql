-- Migration 0011 — feedback
-- Teacher's response on a submission. Either text, audio note, or both.

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  feedback_text text,
  feedback_audio_url text,
  feedback_audio_key text,
  created_at timestamptz DEFAULT now(),
  CHECK (feedback_text IS NOT NULL OR feedback_audio_url IS NOT NULL)
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback visible to student and teacher"
  ON feedback FOR SELECT
  USING (
    submission_id IN (
      SELECT s.id FROM submissions s WHERE s.student_id = auth.uid()
    )
    OR
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers post feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers update own feedback"
  ON feedback FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all feedback"
  ON feedback FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
