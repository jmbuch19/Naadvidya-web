-- ============================================================
-- NAADVIDYA — Combined migration bundle (Phase 1)
-- Paste this into Supabase SQL editor → Run.
-- Idempotent? No — run on a fresh database. Re-running will fail.
-- ============================================================


-- ==== 0001_profiles.sql ====

-- Migration 0001 — profiles
-- Base user table linked to auth.users. Every signed-in user has exactly one row here.
-- MISSING_PIECES patches inlined: timezone, whatsapp_number, whatsapp_opted_in.

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text NOT NULL CHECK (role IN ('owner_admin', 'teacher', 'student')),
  is_owner boolean DEFAULT false,
  phone text,
  city text,
  country text DEFAULT 'India',
  timezone text DEFAULT 'Asia/Kolkata',
  whatsapp_number text,
  whatsapp_opted_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==== 0002_teacher_profiles.sql ====

-- Migration 0002 — teacher_profiles
-- One row per approved/pending teacher. profile_id is the FK to profiles.
-- MISSING_PIECES patch inlined: auto_confirm.

CREATE TABLE teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  bio text,
  years_experience integer DEFAULT 0,
  sangeet_qualifications text[] DEFAULT '{}',
  specializations text[] DEFAULT '{}',
  ragas_taught text[] DEFAULT '{}',
  languages text[] DEFAULT '{Hindi,English}',
  session_fee_inr numeric NOT NULL DEFAULT 800,
  intro_video_url text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_note text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  is_visible boolean DEFAULT false,
  auto_confirm boolean DEFAULT false,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX teacher_profiles_visible_idx ON teacher_profiles(is_visible) WHERE is_visible = true;

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved teachers visible to all"
  ON teacher_profiles FOR SELECT
  USING (is_visible = true OR profile_id = auth.uid());

CREATE POLICY "Teachers can insert own profile"
  ON teacher_profiles FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Teachers can update own profile"
  ON teacher_profiles FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Admin can do everything on teacher_profiles"
  ON teacher_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0003_teacher_availability.sql ====

-- Migration 0003 — teacher_availability
-- Recurring weekly slots. start_time/end_time stored in teacher's timezone (not UTC)
-- because "Tuesday 7pm IST" is a recurring local-time concept, not a UTC moment.

CREATE TABLE teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text DEFAULT 'Asia/Kolkata',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX teacher_availability_teacher_idx ON teacher_availability(teacher_id, is_active);

ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability readable by all"
  ON teacher_availability FOR SELECT USING (true);

CREATE POLICY "Teachers manage own availability"
  ON teacher_availability FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all availability"
  ON teacher_availability FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0004_session_packages.sql ====

-- Migration 0004 — session_packages
-- The 4 starter credit packs. Seeded with the prices from MASTER_SPEC §2.4.

CREATE TABLE session_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credits integer NOT NULL CHECK (credits > 0),
  price_inr numeric NOT NULL CHECK (price_inr >= 0),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active packages visible to all"
  ON session_packages FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manages packages"
  ON session_packages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));

INSERT INTO session_packages (name, description, credits, price_inr, sort_order) VALUES
  ('Ek Swar', 'Try two sessions — a gentle beginning', 2, 1699, 1),
  ('Char Prahar', 'Four sessions across the day''s four prahars', 4, 3299, 2),
  ('Ashtadhatu', 'Eight sessions — one full month of practice', 8, 6399, 3),
  ('Maas Sadhana', 'Twelve sessions — committed sadhana', 12, 9199, 4);

-- ==== 0005_student_credits.sql ====

-- Migration 0005 — student_credits
-- One row per student, auto-created on profile insert (see triggers migration).
-- credits_balance is the source of truth for "can this student book?".

CREATE TABLE student_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  credits_balance integer DEFAULT 0 CHECK (credits_balance >= 0),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own credits"
  ON student_credits FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admin sees all credits"
  ON student_credits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0006_credit_transactions.sql ====

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

-- ==== 0007_bookings.sql ====

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

-- ==== 0008_assignments.sql ====

-- Migration 0008 — assignments
-- Posted by teacher after a session. Linked to a booking. Deliverables is the list
-- of items the student must submit (each gets its own submission_file row).

CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  student_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  description text,
  deliverables text[] DEFAULT '{}',
  due_before timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX assignments_student_idx ON assignments(student_id, due_before);
CREATE INDEX assignments_teacher_idx ON assignments(teacher_id, created_at DESC);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own assignments"
  ON assignments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see assignments they created"
  ON assignments FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers update own assignments"
  ON assignments FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all assignments"
  ON assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0009_submissions.sql ====

-- Migration 0009 — submissions
-- One submission per assignment per student. Files attached via submission_files.

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(assignment_id, student_id)
);

CREATE INDEX submissions_assignment_idx ON submissions(assignment_id);
CREATE INDEX submissions_status_idx ON submissions(status, submitted_at DESC);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own submissions"
  ON submissions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own submissions"
  ON submissions FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own submissions"
  ON submissions FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers see submissions for their assignments"
  ON submissions FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Teachers update submission status"
  ON submissions FOR UPDATE
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admin manages all submissions"
  ON submissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0010_submission_files.sql ====

-- Migration 0010 — submission_files
-- One row per uploaded artifact (audio recording, PDF notes, image, text).
-- file_key is the R2 object key; file_url is the presigned read URL.
-- Files are private — re-generate presigned URLs on display.

CREATE TABLE submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'pdf', 'image', 'text')),
  file_url text NOT NULL,
  file_key text NOT NULL,
  file_name text NOT NULL,
  file_size_kb integer,
  label text,
  uploaded_at timestamptz DEFAULT now()
);

CREATE INDEX submission_files_submission_idx ON submission_files(submission_id);

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submission files visible to student and teacher"
  ON submission_files FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
    OR
    submission_id IN (
      SELECT s.id FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students upload their own files"
  ON submission_files FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Students delete their own files"
  ON submission_files FOR DELETE
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all submission files"
  ON submission_files FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0011_feedback.sql ====

-- Migration 0011 — feedback
-- Teacher's response on a submission. Either text, audio note, or both.

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  feedback_text text,
  feedback_audio_url text,
  feedback_audio_key text,
  created_at timestamptz DEFAULT now(),
  CHECK (feedback_text IS NOT NULL OR feedback_audio_url IS NOT NULL)
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback visible to student and teacher"
  ON feedback FOR SELECT
  USING (
    submission_id IN (
      SELECT s.id FROM submissions s WHERE s.student_id = auth.uid()
    )
    OR
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers post feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers update own feedback"
  ON feedback FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all feedback"
  ON feedback FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- ==== 0012_payouts.sql ====

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

-- ==== 0013_triggers.sql ====

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

-- ==== 0014_amee_seed.sql ====

-- Migration 0014 — Amee seed (RUN MANUALLY AFTER AMEE SIGNS UP)
--
-- This migration is intentionally commented out. After Amee registers on the live
-- platform with her real email, run this SQL (replacing the email) ONCE in the
-- Supabase SQL editor to elevate her account to owner_admin with is_owner=true.
--
-- Without this, the platform has no admin user and the admin dashboard is locked.

-- UPDATE profiles
-- SET role = 'owner_admin', is_owner = true
-- WHERE email = 'amee@naadvidya.in';

-- Sanity check after running:
-- SELECT id, full_name, email, role, is_owner FROM profiles WHERE is_owner = true;
-- Expected: exactly one row.
