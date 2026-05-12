-- Migration 0005 — student_credits
-- One row per student, auto-created on profile insert (see triggers migration).
-- credits_balance is the source of truth for "can this student book?".

CREATE TABLE student_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  credits_balance integer DEFAULT 0 CHECK (credits_balance >= 0),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own credits"
  ON student_credits FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admin sees all credits"
  ON student_credits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
