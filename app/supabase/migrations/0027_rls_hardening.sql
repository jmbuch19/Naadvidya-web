-- Migration 0027 — RLS hardening (audit 2026-05-14)
-- Closes six exploitable gaps in the per-table RLS policies. Strategy: where
-- Postgres RLS column-restriction is awkward, use BEFORE triggers gated on
-- auth.role() and an is_owner_admin() helper. Service-role API routes
-- (createServiceRoleClient on the server) bypass both — existing admin/cron
-- code paths keep working unchanged.

-- ============================================================
-- Helper — is the caller owner_admin? SECURITY DEFINER bypasses RLS on
-- profiles to avoid recursion when this is called from the profiles SELECT
-- policy itself.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_owner_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  );
$$;

-- ============================================================
-- 1. teacher_profiles — block teacher self-approval. Teachers can still edit
--    bio/fees/specializations/auto_confirm/etc., but cannot flip
--    approval_status, is_visible, slug, approved_by/at, rejection_note, or
--    swap profile_id. INSERT by non-admin forces a clean 'pending' row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.teacher_profiles_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'pending';
    NEW.is_visible := false;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.slug := NULL;
    NEW.rejection_note := NULL;
  ELSE
    NEW.approval_status := OLD.approval_status;
    NEW.is_visible := OLD.is_visible;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;
    NEW.slug := OLD.slug;
    NEW.rejection_note := OLD.rejection_note;
    NEW.profile_id := OLD.profile_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teacher_profiles_guard_trg ON public.teacher_profiles;
CREATE TRIGGER teacher_profiles_guard_trg
  BEFORE INSERT OR UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.teacher_profiles_guard();

-- ============================================================
-- 2. profiles SELECT — stop anonymous users from scraping PII (phone,
--    whatsapp_number, email, city) of every user. Allowed reads: self,
--    owner_admin, and profiles tied to a visible teacher (so /teachers and
--    /teachers/[slug] still resolve the embedded full_name via PostgREST).
-- ============================================================
DROP POLICY IF EXISTS "Public profiles readable" ON public.profiles;

CREATE POLICY "Profiles readable scoped" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR public.is_owner_admin()
    OR EXISTS (
      SELECT 1 FROM public.teacher_profiles tp
      WHERE tp.profile_id = profiles.id AND tp.is_visible = true
    )
  );

-- ============================================================
-- 3. audit_logs INSERT — close the spoofing hole. Authenticated callers must
--    set actor_id = themselves; service-role keeps writing freely (cron jobs
--    and webhook handlers).
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;

CREATE POLICY "Callers insert their own audit logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR actor_id = auth.uid()
  );

-- ============================================================
-- 4. bookings UPDATE — column-level immutability for non-admin updates.
--    student_id, teacher_id, scheduled_at, duration, credits_deducted,
--    is_trial, daily_room_*, *_join_url, requested_at, created_at are
--    server-set; status/notes/cancelled_* remain user-mutable. Service-role
--    bypass keeps booking confirm/cancel routes working unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bookings_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner_admin() THEN
    RETURN NEW;
  END IF;

  NEW.student_id := OLD.student_id;
  NEW.teacher_id := OLD.teacher_id;
  NEW.requested_at := OLD.requested_at;
  NEW.scheduled_at := OLD.scheduled_at;
  NEW.duration_minutes := OLD.duration_minutes;
  NEW.is_trial := OLD.is_trial;
  NEW.daily_room_name := OLD.daily_room_name;
  NEW.daily_room_url := OLD.daily_room_url;
  NEW.student_join_url := OLD.student_join_url;
  NEW.teacher_join_url := OLD.teacher_join_url;
  NEW.credits_deducted := OLD.credits_deducted;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_guard_trg ON public.bookings;
CREATE TRIGGER bookings_guard_trg
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_guard();

-- ============================================================
-- 5. submissions INSERT — student must own the target assignment. Stops one
--    student polluting another student's submission list.
-- ============================================================
DROP POLICY IF EXISTS "Students create own submissions" ON public.submissions;

CREATE POLICY "Students create own submissions for own assignments" ON public.submissions
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND assignment_id IN (
      SELECT id FROM public.assignments WHERE student_id = auth.uid()
    )
  );

-- ============================================================
-- 6. feedback INSERT — submission's assignment must belong to the posting
--    teacher. Stops teacher A from attaching feedback to teacher B's
--    student's submission.
-- ============================================================
DROP POLICY IF EXISTS "Teachers post feedback" ON public.feedback;

CREATE POLICY "Teachers feedback own assignments" ON public.feedback
  FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teacher_profiles WHERE profile_id = auth.uid()
    )
    AND submission_id IN (
      SELECT s.id FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id IN (
        SELECT id FROM public.teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );
