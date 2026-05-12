-- Migration 0012 — payouts
-- Created when a session is completed. 80% to teacher / 20% platform cut.
-- EXCEPTION: is_owner_session=true (Amee teaching) → teacher_amount = gross_amount,
-- platform_cut = 0. Amee pays manually via UPI on the 1st and 15th.

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  booking_id uuid NOT NULL REFERENCES bookings(id) UNIQUE,
  gross_amount numeric NOT NULL CHECK (gross_amount >= 0),
  platform_cut numeric NOT NULL CHECK (platform_cut >= 0),
  teacher_amount numeric NOT NULL CHECK (teacher_amount >= 0),
  is_owner_session boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'held')),
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz DEFAULT now(),
  CHECK (gross_amount = platform_cut + teacher_amount)
);

CREATE INDEX payouts_teacher_status_idx ON payouts(teacher_id, status);
CREATE INDEX payouts_pending_idx ON payouts(status, created_at) WHERE status = 'pending';

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own payouts"
  ON payouts FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all payouts"
  ON payouts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
