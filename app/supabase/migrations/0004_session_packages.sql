-- Migration 0004 — session_packages
-- The 4 starter credit packs. Seeded with the prices from MASTER_SPEC §2.4.

CREATE TABLE session_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credits integer NOT NULL CHECK (credits > 0),
  price_inr numeric NOT NULL CHECK (price_inr >= 0),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active packages visible to all"
  ON session_packages FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manages packages"
  ON session_packages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));

INSERT INTO session_packages (name, description, credits, price_inr, sort_order) VALUES
  ('Ek Swar', 'Try two sessions — a gentle beginning', 2, 1699, 1),
  ('Char Prahar', 'Four sessions across the day''s four prahars', 4, 3299, 2),
  ('Ashtadhatu', 'Eight sessions — one full month of practice', 8, 6399, 3),
  ('Maas Sadhana', 'Twelve sessions — committed sadhana', 12, 9199, 4);
