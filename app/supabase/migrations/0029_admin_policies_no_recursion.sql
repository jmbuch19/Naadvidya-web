-- Migration 0029 — rewrite every "Admin" RLS policy to use is_owner_admin()
-- instead of EXISTS(profiles role='owner_admin'). The latter creates recursive
-- policy chains the moment any other table's policy references the table being
-- queried (e.g. profiles SELECT → teacher_profiles SELECT → profiles SELECT).
-- Postgres detects this at plan time and fails the entire query.
--
-- is_owner_admin() now reads from JWT app_metadata (0028) — no table lookup,
-- no recursion possible.

-- assignments
DROP POLICY IF EXISTS "Admin manages all assignments" ON public.assignments;
CREATE POLICY "Admin manages all assignments" ON public.assignments
  FOR ALL USING (public.is_owner_admin());

-- audit_logs
DROP POLICY IF EXISTS "Admin reads all audit logs" ON public.audit_logs;
CREATE POLICY "Admin reads all audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_owner_admin());

-- bookings
DROP POLICY IF EXISTS "Admin sees all bookings" ON public.bookings;
CREATE POLICY "Admin sees all bookings" ON public.bookings
  FOR ALL USING (public.is_owner_admin());

-- class_offerings
DROP POLICY IF EXISTS "Admin manages all offerings" ON public.class_offerings;
CREATE POLICY "Admin manages all offerings" ON public.class_offerings
  FOR ALL USING (public.is_owner_admin());

-- credit_transactions
DROP POLICY IF EXISTS "Admin sees all transactions" ON public.credit_transactions;
CREATE POLICY "Admin sees all transactions" ON public.credit_transactions
  FOR ALL USING (public.is_owner_admin());

-- disputes
DROP POLICY IF EXISTS "Admin manages all disputes" ON public.disputes;
CREATE POLICY "Admin manages all disputes" ON public.disputes
  FOR ALL USING (public.is_owner_admin());

-- enrollments
DROP POLICY IF EXISTS "Admin manages all enrollments" ON public.enrollments;
CREATE POLICY "Admin manages all enrollments" ON public.enrollments
  FOR ALL USING (public.is_owner_admin());

-- feedback
DROP POLICY IF EXISTS "Admin manages all feedback" ON public.feedback;
CREATE POLICY "Admin manages all feedback" ON public.feedback
  FOR ALL USING (public.is_owner_admin());

-- payouts
DROP POLICY IF EXISTS "Admin manages all payouts" ON public.payouts;
CREATE POLICY "Admin manages all payouts" ON public.payouts
  FOR ALL USING (public.is_owner_admin());

-- scheduled_sessions
DROP POLICY IF EXISTS "Admin manages all scheduled sessions" ON public.scheduled_sessions;
CREATE POLICY "Admin manages all scheduled sessions" ON public.scheduled_sessions
  FOR ALL USING (public.is_owner_admin());

-- session_packages
DROP POLICY IF EXISTS "Admin manages packages" ON public.session_packages;
CREATE POLICY "Admin manages packages" ON public.session_packages
  FOR ALL USING (public.is_owner_admin());

-- student_credits
DROP POLICY IF EXISTS "Admin sees all credits" ON public.student_credits;
CREATE POLICY "Admin sees all credits" ON public.student_credits
  FOR ALL USING (public.is_owner_admin());

-- submission_files
DROP POLICY IF EXISTS "Admin manages all submission files" ON public.submission_files;
CREATE POLICY "Admin manages all submission files" ON public.submission_files
  FOR ALL USING (public.is_owner_admin());

-- submissions
DROP POLICY IF EXISTS "Admin manages all submissions" ON public.submissions;
CREATE POLICY "Admin manages all submissions" ON public.submissions
  FOR ALL USING (public.is_owner_admin());

-- teacher_availability
DROP POLICY IF EXISTS "Admin manages all availability" ON public.teacher_availability;
CREATE POLICY "Admin manages all availability" ON public.teacher_availability
  FOR ALL USING (public.is_owner_admin());

-- teacher_holidays
DROP POLICY IF EXISTS "Admin manages all holidays" ON public.teacher_holidays;
CREATE POLICY "Admin manages all holidays" ON public.teacher_holidays
  FOR ALL USING (public.is_owner_admin());

-- teacher_payout_details
DROP POLICY IF EXISTS "Admin reads all payout details" ON public.teacher_payout_details;
CREATE POLICY "Admin reads all payout details" ON public.teacher_payout_details
  FOR SELECT USING (public.is_owner_admin());

-- teacher_profiles
DROP POLICY IF EXISTS "Admin can do everything on teacher_profiles" ON public.teacher_profiles;
CREATE POLICY "Admin can do everything on teacher_profiles" ON public.teacher_profiles
  FOR ALL USING (public.is_owner_admin());

-- voice_repo
DROP POLICY IF EXISTS "Admin manages all voice repo" ON public.voice_repo;
CREATE POLICY "Admin manages all voice repo" ON public.voice_repo
  FOR ALL USING (public.is_owner_admin());

-- voice_repo_collections
DROP POLICY IF EXISTS "Admin manages all collections" ON public.voice_repo_collections;
CREATE POLICY "Admin manages all collections" ON public.voice_repo_collections
  FOR ALL USING (public.is_owner_admin());
