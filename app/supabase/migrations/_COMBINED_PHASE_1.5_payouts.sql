-- ============================================================
-- NAADVIDYA — Phase 1.5 payouts addendum
-- Paste into Supabase SQL editor → Run. Run AFTER the class-types bundle.
-- Adds: teacher_payout_details table; payouts gains nullable booking_id +
--       scheduled_session_id (so Workshop/Gurukul completed sessions generate payouts).
-- ============================================================

-- ==== 0022_teacher_payout_details.sql ====

-- Migration 0022 — teacher_payout_details
-- Where to send a teacher's payouts. Kept in a SEPARATE table (not on teacher_profiles)
-- because teacher_profiles has a public-SELECT RLS policy — payout/bank details must
-- never be readable by anyone except the teacher themselves and the owner_admin.

CREATE TABLE teacher_payout_details (
  teacher_id          uuid PRIMARY KEY REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  payout_method       text CHECK (payout_method IN ('upi', 'bank')),
  upi_id              text,
  bank_account_name   text,
  bank_account_number text,
  bank_ifsc           text,
  updated_at          timestamptz DEFAULT now()
);

ALTER TABLE teacher_payout_details ENABLE ROW LEVEL SECURITY;

-- The owning teacher: full access to their own row.
CREATE POLICY "Teachers manage own payout details"
  ON teacher_payout_details FOR ALL
  USING (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()))
  WITH CHECK (teacher_id IN (SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()));

-- Owner admin (Amee): reads everyone's so she knows where to send money.
CREATE POLICY "Admin reads all payout details"
  ON teacher_payout_details FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE TRIGGER teacher_payout_details_updated_at
  BEFORE UPDATE ON teacher_payout_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==== 0023_payouts_scheduled_sessions.sql ====

-- Migration 0023 — payouts: support Workshop/Gurukul scheduled sessions
-- Until now a payout row required a booking_id (Mehfil only). Make it nullable and
-- add scheduled_session_id so completed Workshop/Gurukul sessions can generate payouts.
-- Exactly one of (booking_id, scheduled_session_id) is set per payout row.

ALTER TABLE payouts ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE payouts ADD COLUMN scheduled_session_id uuid REFERENCES scheduled_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX payouts_scheduled_session_uniq
  ON payouts (scheduled_session_id) WHERE scheduled_session_id IS NOT NULL;

-- XOR: a payout is for a Mehfil booking OR a scheduled session, never both, never neither.
ALTER TABLE payouts ADD CONSTRAINT payouts_source_chk
  CHECK ((booking_id IS NOT NULL) <> (scheduled_session_id IS NOT NULL));

CREATE INDEX payouts_scheduled_session_idx ON payouts(scheduled_session_id);
