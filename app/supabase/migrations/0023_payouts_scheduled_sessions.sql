-- Migration 0023 — payouts: support Workshop/Gurukul scheduled sessions
-- Until now a payout row required a booking_id (Mehfil only). Make it nullable and
-- add scheduled_session_id so completed Workshop/Gurukul sessions can generate payouts.
-- Exactly one of (booking_id, scheduled_session_id) is set per payout row.

ALTER TABLE payouts ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE payouts ADD COLUMN scheduled_session_id uuid REFERENCES scheduled_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX payouts_scheduled_session_uniq
  ON payouts (scheduled_session_id) WHERE scheduled_session_id IS NOT NULL;

-- XOR: a payout is for a Mehfil booking OR a scheduled session, never both, never neither.
ALTER TABLE payouts ADD CONSTRAINT payouts_source_chk
  CHECK ((booking_id IS NOT NULL) <> (scheduled_session_id IS NOT NULL));

CREATE INDEX payouts_scheduled_session_idx ON payouts(scheduled_session_id);
