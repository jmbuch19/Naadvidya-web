-- Migration 0030 — two-party reschedule proposal flow (SCHEDULING_HOLIDAY_POLICY §2)
--
-- Flow: initiator (student OR teacher) sets reschedule_proposed_* with a new time
-- and reason. Other party has 24h to accept (session moves, reschedule_count++,
-- daily room regen) or decline (proposal cleared, original time stands). Cron
-- expires stale pending proposals.
--
-- bookings reaches parity with scheduled_sessions on the audit columns
-- (reschedule_count / rescheduled_from / rescheduled_reason). BOTH tables get
-- the pending-proposal columns since Mehfil (bookings) and Gurukul
-- (scheduled_sessions) use the same flow.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_reason text,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_new_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_proposal_reason text;

ALTER TABLE scheduled_sessions
  ADD COLUMN IF NOT EXISTS reschedule_proposed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_proposed_new_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_proposal_reason text;

-- Holiday-affected sessions need a clear cancellation reason. The existing
-- bookings.cancelled_reason text column is already sufficient; we just use a
-- consistent literal ("Teacher holiday") so the dashboard can highlight these.
-- No schema change required for that wiring.
