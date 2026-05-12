import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Email confirmation / OAuth callback handler.
// Exchanges the auth code for a session, then redirects to ?next= or /dashboard.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
