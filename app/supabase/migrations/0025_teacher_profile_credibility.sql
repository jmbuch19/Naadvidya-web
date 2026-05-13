-- Migration 0025 — richer teacher profile fields
-- Adds the four credibility signals every Indian Classical student asks for first:
--   1. gharana / lineage  (single text field — Gwalior, Kirana, Patiala, Benaras, etc.)
--   2. gurus               (array — names of teachers they trained under)
--   3. instruments         (array — Tabla, Sitar, Voice, etc. — separated from style)
--   4. student_levels      (array — which levels they accept: Beginner / Intermediate / Advanced)
--
-- All four are nullable / default-empty so existing teacher rows keep working without
-- a backfill. The ProfileEditor surfaces them; public teacher page renders them when present.

ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS gharana text,
  ADD COLUMN IF NOT EXISTS gurus text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS instruments text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS student_levels text[] DEFAULT '{}';

COMMENT ON COLUMN teacher_profiles.gharana IS 'School / lineage e.g. Gwalior, Kirana, Patiala. Single free-text field.';
COMMENT ON COLUMN teacher_profiles.gurus IS 'Names of gurus this teacher studied under.';
COMMENT ON COLUMN teacher_profiles.instruments IS 'Instruments taught (Tabla, Sitar, Voice, Harmonium, etc.). Distinct from specializations (which covers style: Khayal, Thumri, ...).';
COMMENT ON COLUMN teacher_profiles.student_levels IS 'Levels accepted: subset of {Beginner, Intermediate, Advanced}.';
