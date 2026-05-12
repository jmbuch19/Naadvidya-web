-- Migration 0020 — audit_logs (Phase 1.5)
-- Append-only trail of significant actions. Admin reads; the app inserts via the
-- service-role client. (No UI yet — Phase 1.5 Part 2 / Phase 2.)

CREATE TABLE audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id),
  actor_role    text,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  old_value     jsonb,
  new_value     jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX audit_logs_actor_idx ON audit_logs(actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads all audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'));

-- Inserts come from the service-role client (bypasses RLS) or any authenticated
-- session; never updated or deleted from the app.
CREATE POLICY "Authenticated can insert audit logs"
  ON audit_logs FOR INSERT WITH CHECK (true);
