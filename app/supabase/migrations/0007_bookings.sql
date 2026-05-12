-- Migration 0007 — bookings
-- Mehfil session bookings (Phase 1). is_trial added for free 15-min intro call:
-- max one trial per (student, teacher) pair, costs 0 credits, 15-min duration.

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  requested_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  duration_minutes integer DEFAULT 60 CHECK (duration_minutes IN (15, 45, 60, 90)),
  is_trial boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  daily_room_name text,
  daily_room_url text,
  student_join_url text,
  teacher_join_url text,
  notes_to_teacher text,
  credits_deducted integer DEFAULT 1 CHECK (credits_deducted >= 0),
  cancelled_reason text,
  cancelled_by uuid REFERENCES profiles(id),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trials cost 0 credits and are 15 minutes
ALTER TABLE bookings ADD CONSTRAINT trial_invariants CHECK (
  (is_trial = false) OR (is_trial = true AND credits_deducted = 0 AND duration_minutes = 15)
);

-- One trial booking per (student, teacher) pair, regardless of status
CREATE UNIQUE INDEX one_trial_per_pair ON bookings (student_id, teacher_id) WHERE is_trial = true;

CREATE INDEX bookings_student_idx ON bookings(student_id, scheduled_at DESC);
CREATE INDEX bookings_teacher_idx ON bookings(teacher_id, scheduled_at DESC);
CREATE INDEX bookings_status_idx ON bookings(status, scheduled_at);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own bookings"
  ON bookings FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see their bookings"
  ON bookings FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin sees all bookings"
  ON bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

CREATE POLICY "Students can create bookings"
  ON bookings FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own bookings (cancel only)"
  ON bookings FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers can update booking status"
  ON bookings FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );
