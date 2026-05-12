-- Migration 0013 — triggers and helper functions

-- Auto-create student_credits row when a 'student' profile is created.
CREATE OR REPLACE FUNCTION create_student_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO student_credits (student_id, credits_balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (student_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION create_student_credits();

-- Generic updated_at bumper.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teacher_profiles_updated_at
BEFORE UPDATE ON teacher_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Bump student_credits.updated_at when balance changes
CREATE TRIGGER student_credits_updated_at
BEFORE UPDATE ON student_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Helper: atomic credit ledger entry + balance update.
-- Use this from API routes instead of two separate updates to keep ledger consistent.
CREATE OR REPLACE FUNCTION apply_credit_change(
  p_student_id uuid,
  p_type text,
  p_credits integer,
  p_package_id uuid DEFAULT NULL,
  p_razorpay_order_id text DEFAULT NULL,
  p_razorpay_payment_id text DEFAULT NULL,
  p_booking_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delta integer;
  v_txn_id uuid;
BEGIN
  -- type semantics: purchase/refund/goodwill add credits; debit subtracts
  IF p_type IN ('purchase', 'refund', 'goodwill') THEN
    v_delta := p_credits;
  ELSIF p_type = 'debit' THEN
    v_delta := -p_credits;
  ELSE
    RAISE EXCEPTION 'invalid credit transaction type: %', p_type;
  END IF;

  -- Insert ledger row first
  INSERT INTO credit_transactions (
    student_id, type, credits, package_id,
    razorpay_order_id, razorpay_payment_id, booking_id, note
  ) VALUES (
    p_student_id, p_type, p_credits, p_package_id,
    p_razorpay_order_id, p_razorpay_payment_id, p_booking_id, p_note
  ) RETURNING id INTO v_txn_id;

  -- Update balance (CHECK constraint will block negatives)
  UPDATE student_credits
  SET credits_balance = credits_balance + v_delta
  WHERE student_id = p_student_id;

  RETURN v_txn_id;
END;
$$;
