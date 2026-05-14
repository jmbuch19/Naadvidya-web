import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PKCE-free token_hash confirmation endpoint. Email templates link directly here
// (no supabase.co bounce) — Safe Browsing classifiers flag the cross-domain redirect
// chain as a phishing shape even though it's legitimate, so we keep everything on
// the apex domain. supabase.auth.verifyOtp() still server-verifies the token, so the
// security guarantees are identical to the old /api/auth/callback?code=... path.

type OtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

const ALLOWED_TYPES = new Set<OtpType>([
  'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as OtpType | null;
  const nextRaw = url.searchParams.get('next') ?? '/dashboard';

  // Whitelist `next` to relative paths to prevent open-redirect.
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent('Invalid or expired confirmation link.')}`
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${url.origin}${next}`);
}
