-- Migration 0001 — profiles
-- Base user table linked to auth.users. Every signed-in user has exactly one row here.
-- MISSING_PIECES patches inlined: timezone, whatsapp_number, whatsapp_opted_in.

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text NOT NULL CHECK (role IN ('owner_admin', 'teacher', 'student')),
  is_owner boolean DEFAULT false,
  phone text,
  city text,
  country text DEFAULT 'India',
  timezone text DEFAULT 'Asia/Kolkata',
  whatsapp_number text,
  whatsapp_opted_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles readable"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
