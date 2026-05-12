import Link from 'next/link';
import { loginAction } from '../actions';

interface PageProps {
  searchParams: { error?: string; returnTo?: string; info?: string };
}

export const metadata = { title: 'Sign in — Naadvidya' };

export default function LoginPage({ searchParams }: PageProps) {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-maroon mb-2">Welcome back</h1>
      <p className="text-muted-warm text-sm mb-6">Sign in to continue your sadhana.</p>

      {searchParams.error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-800">
          {searchParams.error}
        </div>
      )}
      {searchParams.info && (
        <div className="mb-4 p-3 rounded border border-gold/40 bg-parchment-2 text-sm text-ink">
          {searchParams.info}
        </div>
      )}

      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="returnTo" value={searchParams.returnTo ?? '/dashboard'} />

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

        <label className="block">
          <span className="text-sm text-ink">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
        </label>

        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>

      <p className="mt-6 text-sm text-muted-warm text-center">
        New to Naadvidya?{' '}
        <Link href="/register" className="text-maroon-mid hover:underline">Create an account</Link>
      </p>
    </>
  );
}
