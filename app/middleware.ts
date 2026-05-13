import { updateSession } from './lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, the public PWA files (sw.js, manifest),
    // the Razorpay webhook (own HMAC signature), and the cron routes (own CRON_SECRET).
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icon|apple-icon|api/payments/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
