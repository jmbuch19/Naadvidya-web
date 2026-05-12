import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resetPasswordAction } from '../actions';

interface PageProps {
  searchParams: { error?: string };
}

export const metadata = { title: 'Set a new password — Naadvidya' };

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  // The recovery link routed through /api/auth/callback, which set a session cookie.
  // If there's no user here, the link was missing/expired/already used.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h1 className="font-display text-3xl font-semibold text-maroon mb-2">Link expired</h1>
        <p className="text-muted-warm text-sm mb-6">
          This password-reset link is invalid or has already been used. Request a fresh one.
        </p>
        <Link href="/forgot-password" className="btn-primary w-full inline-flex justify-center">Request a new link</Link>
        <p className="mt-6 text-sm text-muted-warm text-center">
          <Link href="/login" className="text-maroon-mid hover:underline">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-maroon mb-2">Set a new password</h1>
      <p className="text-muted-warm text-sm mb-6">Choose a new password for <strong>{user.email}</strong>.</p>

      {searchParams.error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      <form action={resetPasswordAction} className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
          <span className="block mt-1 text-xs text-muted-warm">Minimum 8 characters.</span>
        </label>
        <label className="block">
          <span className="text-sm text-ink">Confirm new password</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
        </label>
        <button type="submit" className="btn-primary w-full">Update password</button>
      </form>
    </>
  );
}
