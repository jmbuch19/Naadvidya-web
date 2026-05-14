-- One-off cleanup: delete BOTH auth.users rows for jambuch@gmail.com so Jaydeep can
-- re-register cleanly. ON DELETE CASCADE removes the profiles row, which cascades to
-- teacher_profiles, student_credits, bookings, etc.
--
-- RUN ORDER:
--   1. First, run the SELECT to confirm which rows exist.
--   2. Then run the DELETE (which targets auth.users — everything else cascades).
--   3. Then run migration 0026_profiles_email_unique.sql.

-- Step 1 — inspect first. Should return 1–2 rows.
SELECT
  u.id            AS auth_user_id,
  u.email         AS auth_email,
  u.created_at    AS auth_created,
  u.email_confirmed_at,
  p.role,
  p.full_name,
  EXISTS(SELECT 1 FROM teacher_profiles tp WHERE tp.profile_id = u.id) AS has_teacher_profile,
  EXISTS(SELECT 1 FROM bookings b WHERE b.student_id = u.id OR b.teacher_id = u.id) AS has_bookings
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE LOWER(u.email) = 'jambuch@gmail.com'
ORDER BY u.created_at;

-- Step 2 — once confirmed, delete both. ON DELETE CASCADE from profiles → all child
-- tables (teacher_profiles, student_credits, etc.) handles the rest. auth.users itself
-- cascades to profiles via the FK on profiles.id.
--
-- DELETE FROM auth.users WHERE LOWER(email) = 'jambuch@gmail.com';
