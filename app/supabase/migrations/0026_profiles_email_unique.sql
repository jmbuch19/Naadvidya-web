-- Migration 0026 — enforce one-person-one-email at the database level.
-- Case-insensitive: 'Foo@x.com' and 'foo@x.com' collide.
-- If this index creation fails, you have duplicate rows — run the dup-finder query
-- in NAADVIDYA_DEDUP.md (or inline below) to clean them up first.

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_unique
  ON profiles (LOWER(email));

-- Inline duplicate finder (informational — not executed):
-- SELECT LOWER(email) AS email, COUNT(*) AS n, array_agg(id) AS profile_ids
-- FROM profiles
-- GROUP BY LOWER(email)
-- HAVING COUNT(*) > 1;
