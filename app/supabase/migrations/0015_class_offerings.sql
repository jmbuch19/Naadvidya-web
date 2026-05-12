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
