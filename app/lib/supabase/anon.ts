// Anonymous server-side client — no cookies, for public reads only.
// Use this in /teachers, /teachers/[slug], hero page etc. where we just want
// the publicly-visible rows under RLS without any session.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let cached: ReturnType<typeof createSupabaseClient> | null = null;

export function createAnonClient() {
  if (cached) return cached;
  cached = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
  return cached;
}
