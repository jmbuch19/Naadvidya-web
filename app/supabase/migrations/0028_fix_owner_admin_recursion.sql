-- Migration 0028 — fix profiles RLS recursion introduced in 0027
--
-- Root cause: is_owner_admin() queried profiles; the profiles SELECT policy
-- uses is_owner_admin(); PostgreSQL detects this as a recursive policy
-- reference at plan time and raises "infinite recursion detected in policy
-- for relation profiles" — even though SECURITY DEFINER + a BYPASSRLS owner
-- (postgres) would dodge it at runtime. The recursion check is structural.
--
-- Result: every cookie-bound SELECT on profiles for an authenticated user
-- silently returned null. /dashboard couldn't read role → couldn't redirect
-- teachers/admins → rendered the student fallback for everyone.
--
-- Fix: source admin status from JWT app_metadata instead of profiles. No
-- table lookup → no recursion. App code is responsible for syncing
-- raw_app_meta_data.role on auth.users whenever profile.role flips to/from
-- owner_admin (single point of admin promotion is the Amee seed migration).

CREATE OR REPLACE FUNCTION public.is_owner_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner_admin',
    false
  );
$$;

-- Backfill: any existing owner_admin profile gets its role written into
-- auth.users.raw_app_meta_data so the JWT-based check matches. No-op if no
-- owner_admin profiles exist yet (Amee hasn't been promoted at the time of
-- writing this migration).
UPDATE auth.users u
SET raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'owner_admin')
FROM public.profiles p
WHERE p.id = u.id AND p.role = 'owner_admin';
