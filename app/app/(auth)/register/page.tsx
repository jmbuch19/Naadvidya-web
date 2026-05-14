import Link from 'next/link';
import { registerAction } from '../actions';

interface PageProps {
  searchParams: { error?: string; info?: string; role?: 'student' | 'teacher' };
}

export const metadata = { title: 'Create your account — Naadvidya' };

export default function RegisterPage({ searchParams }: PageProps) {
  const defaultRole = searchParams.role === 'teacher' ? 'teacher' : 'student';

  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-maroon mb-2">Begin your journey</h1>
      <p className="text-muted-warm text-sm mb-6">
        Create your Naadvidya account. Teachers go through Amee&rsquo;s approval before going live.
      </p>

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

      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="timezone" id="tz-field" value="Asia/Kolkata" />

        <fieldset className="grid grid-cols-2 gap-3">
          <label className="flex flex-col p-3 rounded border border-line cursor-pointer hover:border-maroon-mid has-[input:checked]:border-maroon-mid has-[input:checked]:bg-parchment-2">
            <input type="radio" name="role" value="student" defaultChecked={defaultRole === 'student'} className="sr-only peer" />
            <span className="font-display text-lg text-maroon">Student</span>
            <span className="text-xs text-muted-warm">Find a guru, book sessions</span>
          </label>
          <label className="flex flex-col p-3 rounded border border-line cursor-pointer hover:border-maroon-mid has-[input:checked]:border-maroon-mid has-[input:checked]:bg-parchment-2">
            <input type="radio" name="role" value="teacher" defaultChecked={defaultRole === 'teacher'} className="sr-only peer" />
            <span className="font-display text-lg text-maroon">Teacher</span>
            <span className="text-xs text-muted-warm">Apply to join the faculty</span>
          </label>
        </fieldset>

        <label className="block">
          <span className="text-sm text-ink">Full name</span>
          <input
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
        </label>

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
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
          <span className="block mt-1 text-xs text-muted-warm">Minimum 8 characters.</span>
        </label>

        <label className="block">
          <span className="text-sm text-ink">Confirm password</span>
          <input
            name="password_confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full px-3 py-2 rounded border border-line bg-parchment focus:outline-none focus:border-maroon-mid"
          />
        </label>

        <button type="submit" className="btn-primary w-full">Create account</button>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;var el=document.getElementById('tz-field');if(tz&&el)el.value=tz;}catch(e){}`,
        }}
      />

      <p className="mt-6 text-sm text-muted-warm text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-maroon-mid hover:underline">Sign in</Link>
      </p>
    </>
  );
}
