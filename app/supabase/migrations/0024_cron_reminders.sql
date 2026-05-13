-- Migration 0024 — cron dedup flags
-- Booleans/timestamps the scheduled jobs use to avoid sending duplicate reminders.

ALTER TABLE bookings
  ADD COLUMN reminded_24hr boolean DEFAULT false,
  ADD COLUMN reminded_1hr  boolean DEFAULT false,
  ADD COLUMN reminded_start boolean DEFAULT false;

ALTER TABLE scheduled_sessions
  ADD COLUMN reminded_24hr boolean DEFAULT false,
  ADD COLUMN reminded_1hr  boolean DEFAULT false,
  ADD COLUMN reminded_start boolean DEFAULT false;

ALTER TABLE assignments
  ADD COLUMN due_reminded boolean DEFAULT false;

ALTER TABLE student_credits
  ADD COLUMN low_credit_warned_at timestamptz;
