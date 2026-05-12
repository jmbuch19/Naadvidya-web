import { updateSession } from './lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, the public PWA files (sw.js, manifest),
    // and the Razorpay webhook (which uses its own HMAC signature, not session cookies).
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon|apple-icon|api/payments/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
