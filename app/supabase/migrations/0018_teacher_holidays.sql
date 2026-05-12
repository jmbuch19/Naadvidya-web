-- Migration 0018 — teacher_holidays (Phase 1.5)
-- Days a teacher marks off. Bulk scheduling skips these. Students with upcoming
-- sessions on a marked date get notified (NAADVIDYA_SCHEDULING_HOLIDAY_POLICY.md).

CREATE TABLE teacher_holidays (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id        uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  holiday_date      date NOT NULL,
  reason            text,
  affects_students  boolean DEFAULT true,
  notified_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  UNIQUE(teacher_id, holiday_date)
);

CREATE INDEX teacher_holidays_teacher_idx ON teacher_holidays(teacher_id, holiday_date);

ALTER TABLE teacher_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holidays readable by all"
  ON teacher_holidays FOR SELECT USING (true);

CREATE POLICY "Teachers manage own holidays"
  ON teacher_holidays FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "Admin manages all holidays"
  ON teacher_holidays FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));
