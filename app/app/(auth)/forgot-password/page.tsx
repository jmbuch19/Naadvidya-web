import Link from 'next/link';
import { forgotPasswordAction } from '../actions';

interface PageProps {
  searchParams: { error?: string; sent?: string };
}

export const metadata = { title: 'Reset your password — Naadvidya' };

export default function ForgotPasswordPage({ searchParams }: PageProps) {
  const sent = searchParams.sent === '1';

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-maroon mb-2">Reset your password</h1>
      <p className="text-muted-warm text-sm mb-6">
        Enter the email you registered with. If it&rsquo;s in our records, we&rsquo;ll send you a link to set a new password.
      </p>

      {searchParams.error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}

      {sent ? (
        <div className="p-4 rounded border border-gold/40 bg-parchment-2 text-sm text-ink">
          <p className="font-medium text-maroon mb-1">Check your inbox.</p>
          <p>
            If an account exists for that email, a password-reset link is on its way. It expires in
            an hour. Didn&rsquo;t get it? Check spam, or{' '}
            <Link href="/forgot-password" className="text-maroon-mid hover:underline">try again</Link>.
          </p>
        </div>
      ) : (
        <form action={forgotPasswordAction} className="space-y-4">
          <label className="block">
            <span className="text-sm text-ink">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
            />
          </label>
          <button type="submit" className="btn-primary w-full">Send reset link</button>
        </form>
      )}

      <p className="mt-6 text-sm text-muted-warm text-center">
        Remembered it? <Link href="/login" className="text-maroon-mid hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
