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
