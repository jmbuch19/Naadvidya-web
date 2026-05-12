-- Migration 0021 — Voice Repo (Phase 1.5)
-- Teacher's library of short reference recordings. Streamed, never downloaded.
-- One public sample per teacher (acquisition tool); the rest are gated to students
-- who have booked >= 1 session with that teacher.
--
-- NOTE: NAADVIDYA_VOICE_REPO_AND_PLUGINS.md numbers these as migrations 021 (voice_repo)
-- + 022 (voice_repo_collections), but voice_repo FKs voice_repo_collections, so we
-- create collections FIRST here in a single migration to avoid a forward reference.

CREATE TABLE voice_repo_collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX voice_repo_collections_teacher_idx ON voice_repo_collections(teacher_id, sort_order);

CREATE TABLE voice_repo (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  raga              text,
  taal              text,
  category          text CHECK (category IN (
                      'demonstration', 'alankaar', 'bandish', 'taal_theka',
                      'pronunciation', 'improvisation', 'correction', 'general'
                    )),
  level_min         integer DEFAULT 0 CHECK (level_min BETWEEN 0 AND 7),
  level_max         integer DEFAULT 7 CHECK (level_max BETWEEN 0 AND 7),
  file_url          text NOT NULL,         -- R2 object key (we re-presign on read; never a public URL)
  file_key          text NOT NULL,
  file_size_kb      integer,
  duration_seconds  integer,
  notes_text        text,
  notes_pdf_url     text,                  -- R2 key for an optional notation PDF
  notes_pdf_key     text,
  collection_id     uuid REFERENCES voice_repo_collections(id) ON DELETE SET NULL,
  is_public_sample  boolean DEFAULT false,
  is_active         boolean DEFAULT true,
  play_count        integer DEFAULT 0,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CHECK (level_max >= level_min)
);

-- One public sample per teacher.
CREATE UNIQUE INDEX one_public_sample_per_teacher
  ON voice_repo (teacher_id) WHERE is_public_sample = true;

CREATE INDEX voice_repo_teacher_idx ON voice_repo(teacher_id, sort_order);
CREATE INDEX voice_repo_collection_idx ON voice_repo(collection_id);
CREATE INDEX voice_repo_public_sample_idx ON voice_repo(teacher_id) WHERE is_public_sample = true AND is_active = true;

ALTER TABLE voice_repo ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_repo_collections ENABLE ROW LEVEL SECURITY;

-- voice_repo: public sample visible to everyone.
CREATE POLICY "Public samples visible to everyone"
  ON voice_repo FOR SELECT
  USING (is_public_sample = true AND is_active = true);

-- voice_repo: non-public recordings visible to students who've booked this teacher,
-- and to the teacher themselves.
CREATE POLICY "Gated recordings visible to booked students and owner"
  ON voice_repo FOR SELECT
  USING (
    teacher_id IN (
      SELECT tp.id FROM teacher_profiles tp
      JOIN bookings b ON b.teacher_id = tp.id
      WHERE b.student_id = auth.uid()
        AND b.status IN ('confirmed', 'completed')
    )
    OR
    teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid())
  );

CREATE POLICY "Teachers manage own voice repo"
  ON voice_repo FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all voice repo"
  ON voice_repo FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- voice_repo_collections: readable by anyone (just metadata; the recordings inside
-- are still gated by voice_repo's own policies).
CREATE POLICY "Collections readable by all"
  ON voice_repo_collections FOR SELECT USING (true);

CREATE POLICY "Teachers manage own collections"
  ON voice_repo_collections FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all collections"
  ON voice_repo_collections FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- updated_at bump
CREATE TRIGGER voice_repo_updated_at
  BEFORE UPDATE ON voice_repo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Increment play_count atomically (server calls this when a stream URL is issued).
CREATE OR REPLACE FUNCTION increment_voice_repo_play_count(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE voice_repo SET play_count = play_count + 1 WHERE id = p_id;
END;
$$;
