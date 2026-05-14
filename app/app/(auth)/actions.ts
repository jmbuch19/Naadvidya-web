'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/supabase/types';

// Build an absolute origin from the request headers (works on Vercel even if
// NEXT_PUBLIC_APP_URL is mis-set), falling back to NEXT_PUBLIC_APP_URL then localhost.
function requestOrigin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) {
    const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '/dashboard');

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&returnTo=${encodeURIComponent(returnTo)}`);
  }

  redirect(returnTo);
}

export async function registerAction(formData: FormData) {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const role = String(formData.get('role') ?? 'student') as Role;
  const detectedTz = String(formData.get('timezone') ?? 'Asia/Kolkata');

  if (!fullName || !email || password.length < 8) {
    redirect(`/register?error=${encodeURIComponent('Please provide your name, email and a password of at least 8 characters.')}`);
  }

  if (role !== 'student' && role !== 'teacher') {
    redirect(`/register?error=${encodeURIComponent('Invalid role.')}`);
  }

  const supabase = createClient();

  // One person, one role, one email. Reject if a profile already exists for this email
  // (case-insensitive) BEFORE creating a duplicate auth.users row. The
  // profiles_email_lower_unique index also enforces this at the DB level as a backstop.
  const { data: existing } = await supabase
    .from('profiles')
    .select('role')
    .ilike('email', email)
    .maybeSingle<{ role: 'owner_admin' | 'teacher' | 'student' }>();

  if (existing) {
    const roleLabel = existing.role === 'owner_admin' ? 'an admin' : `a ${existing.role}`;
    redirect(`/register?error=${encodeURIComponent(`An account already exists for this email as ${roleLabel}. Sign in instead, or use a different email.`)}`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: `${requestOrigin()}/api/auth/callback`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.user) {
    redirect(`/register?info=${encodeURIComponent('Check your inbox to confirm your email, then sign in.')}`);
  }

  // Profile + teacher_profile inserts run with the service-role key. The cookie-bound
  // client can't insert here when email confirmation is on: signUp creates the auth.users
  // row but does NOT establish a session, so auth.uid() is null and the RLS policy
  // (auth.uid() = id) rejects the insert silently — leaving an orphan auth user with no
  // profile. owner_admin can still only be set via the seed migration; this endpoint
  // hard-rejects that role above.
  const admin = createServiceRoleClient();

  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    email,
    role,
    timezone: detectedTz,
  });

  if (profileError) {
    redirect(`/register?error=${encodeURIComponent('Account created but profile setup failed: ' + profileError.message)}`);
  }

  if (role === 'teacher') {
    await admin.from('teacher_profiles').insert({
      profile_id: data.user.id,
      bio: '',
      session_fee_inr: 800,
    });
  }

  redirect('/dashboard');
}

export async function logoutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// --- Password reset ---

export async function forgotPasswordAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    redirect(`/forgot-password?error=${encodeURIComponent('Enter a valid email address.')}`);
  }

  const supabase = createClient();
  // The recovery email links to Supabase's verify endpoint, which then redirects to
  // our auth callback (which exchanges the code and sets the session cookie), then on
  // to /reset-password where the user is signed in via the recovery session.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${requestOrigin()}/api/auth/callback?next=/reset-password`,
  });

  // Don't reveal whether the email exists — always show the same confirmation.
  redirect(`/forgot-password?sent=1`);
}

export async function resetPasswordAction(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < 8) {
    redirect(`/reset-password?error=${encodeURIComponent('Password must be at least 8 characters.')}`);
  }
  if (password !== confirm) {
    redirect(`/reset-password?error=${encodeURIComponent('Passwords do not match.')}`);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/reset-password?error=${encodeURIComponent('Your reset link has expired. Request a new one.')}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect('/dashboard');
}
