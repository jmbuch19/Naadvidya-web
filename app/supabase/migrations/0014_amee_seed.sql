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
