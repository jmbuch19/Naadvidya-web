-- Migration 0006 — credit_transactions
-- Immutable ledger. Every change to credits_balance has a row here.
-- type: 'purchase' (from Razorpay), 'debit' (booking created), 'refund' (cancellation, goodwill)

CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'debit', 'refund', 'goodwill')),
  credits integer NOT NULL,
  package_id uuid REFERENCES session_packages(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  booking_id uuid,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX credit_transactions_student_idx ON credit_transactions(student_id, created_at DESC);
CREATE INDEX credit_transactions_razorpay_payment_idx ON credit_transactions(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own transactions"
  ON credit_transactions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admin sees all transactions"
  ON credit_transactions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
