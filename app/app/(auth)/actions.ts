'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/supabase/types';

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.user) {
    redirect(`/register?info=${encodeURIComponent('Check your inbox to confirm your email, then sign in.')}`);
  }

  // Create the profiles row (RLS allows: user inserts own profile).
  // role defaults to whatever they picked; owner_admin is set manually via the Amee seed migration.
  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    full_name: fullName,
    email,
    role,
    timezone: detectedTz,
  });

  if (profileError) {
    redirect(`/register?error=${encodeURIComponent('Account created but profile setup failed: ' + profileError.message)}`);
  }

  // If teacher, create the pending teacher_profile too
  if (role === 'teacher') {
    await supabase.from('teacher_profiles').insert({
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
