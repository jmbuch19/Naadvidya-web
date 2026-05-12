-- Migration 0019 — disputes (Phase 1.5)
-- Raised by a student or teacher about a booking or enrolment. Amee resolves them.

CREATE TABLE disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by         uuid NOT NULL REFERENCES profiles(id),
  against           uuid REFERENCES profiles(id),
  booking_id        uuid REFERENCES bookings(id),
  enrollment_id     uuid REFERENCES enrollments(id),
  dispute_type      text NOT NULL CHECK (dispute_type IN ('no_show', 'quality', 'payment', 'harassment', 'technical', 'other')),
  description       text NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'escalated', 'closed')),
  resolution        text,
  resolved_by       uuid REFERENCES profiles(id),
  resolved_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX disputes_status_idx ON disputes(status, created_at);
CREATE INDEX disputes_raised_by_idx ON disputes(raised_by);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Involved parties see their disputes"
  ON disputes FOR SELECT
  USING (raised_by = auth.uid() OR against = auth.uid());

CREATE POLICY "Anyone signed in can raise a dispute about themselves"
  ON disputes FOR INSERT WITH CHECK (raised_by = auth.uid());

CREATE POLICY "Admin manages all disputes"
  ON disputes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
