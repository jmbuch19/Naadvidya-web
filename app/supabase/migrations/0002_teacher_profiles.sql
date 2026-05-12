-- Migration 0002 — teacher_profiles
-- One row per approved/pending teacher. profile_id is the FK to profiles.
-- MISSING_PIECES patch inlined: auto_confirm.

CREATE TABLE teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bio text,
  years_experience integer DEFAULT 0,
  sangeet_qualifications text[] DEFAULT '{}',
  specializations text[] DEFAULT '{}',
  ragas_taught text[] DEFAULT '{}',
  languages text[] DEFAULT '{Hindi,English}',
  session_fee_inr numeric NOT NULL DEFAULT 800,
  intro_video_url text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_note text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  is_visible boolean DEFAULT false,
  auto_confirm boolean DEFAULT false,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX teacher_profiles_visible_idx ON teacher_profiles(is_visible) WHERE is_visible = true;

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved teachers visible to all"
  ON teacher_profiles FOR SELECT
  USING (is_visible = true OR profile_id = auth.uid());

CREATE POLICY "Teachers can insert own profile"
  ON teacher_profiles FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Teachers can update own profile"
  ON teacher_profiles FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Admin can do everything on teacher_profiles"
  ON teacher_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));
