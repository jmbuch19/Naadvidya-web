// Server-side data fetch helpers. Gracefully no-op when env vars aren't set
// (so the app renders during local dev before Supabase is provisioned).

import { createAnonClient } from './anon';
import type { TeacherProfileRow, ProfileRow } from './types';

export type PublicTeacher = Pick<
  TeacherProfileRow,
  'id' | 'slug' | 'bio' | 'specializations' | 'ragas_taught' | 'languages' | 'session_fee_inr' | 'intro_video_url' | 'years_experience' | 'sangeet_qualifications'
> & {
  profile: Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'is_owner' | 'city'>;
};

function supabaseConfigured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function getApprovedTeachers(): Promise<PublicTeacher[]> {
  if (!supabaseConfigured()) return [];

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('teacher_profiles')
      .select(
        'id, slug, bio, specializations, ragas_taught, languages, session_fee_inr, intro_video_url, years_experience, sangeet_qualifications, profile:profiles!teacher_profiles_profile_id_fkey(id, full_name, avatar_url, is_owner, city)'
      )
      .eq('is_visible', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[queries] getApprovedTeachers failed:', error.message);
      return [];
    }
    return (data ?? []) as unknown as PublicTeacher[];
  } catch (e) {
    console.warn('[queries] getApprovedTeachers exception:', e);
    return [];
  }
}

// Voice Repo public sample for a teacher — visible to anyone (RLS allows anon SELECT
// of is_public_sample = true). Returns null if the teacher hasn't set one.
export interface PublicSample {
  id: string;
  title: string;
  description: string | null;
  raga: string | null;
  taal: string | null;
  category: string | null;
  level_min: number;
  level_max: number;
  duration_seconds: number | null;
  notes_text: string | null;
  notes_pdf_url: string | null;
  notes_pdf_key: string | null;
  is_public_sample: boolean;
}

export async function getTeacherPublicSample(teacherId: string): Promise<PublicSample | null> {
  if (!supabaseConfigured()) return null;
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('voice_repo')
      .select('id, title, description, raga, taal, category, level_min, level_max, duration_seconds, notes_text, notes_pdf_url, notes_pdf_key, is_public_sample')
      .eq('teacher_id', teacherId)
      .eq('is_public_sample', true)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as PublicSample;
  } catch {
    return null;
  }
}

export async function getTeacherBySlug(slug: string): Promise<PublicTeacher | null> {
  if (!supabaseConfigured()) return null;

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('teacher_profiles')
      .select(
        'id, slug, bio, specializations, ragas_taught, languages, session_fee_inr, intro_video_url, years_experience, sangeet_qualifications, profile:profiles!teacher_profiles_profile_id_fkey(id, full_name, avatar_url, is_owner, city)'
      )
      .eq('slug', slug)
      .eq('is_visible', true)
      .maybeSingle();

    if (error) {
      console.warn('[queries] getTeacherBySlug failed:', error.message);
      return null;
    }
    return (data ?? null) as unknown as PublicTeacher | null;
  } catch (e) {
    console.warn('[queries] getTeacherBySlug exception:', e);
    return null;
  }
}

// Get Amee's profile (the platform owner). She may also have a teacher_profile;
// the home page uses this to render her trust-anchor block separately from the
// "Meet Your Gurus" grid.
export type AmeeProfile = Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'city'> & {
  teacher: Pick<TeacherProfileRow, 'id' | 'bio' | 'specializations' | 'sangeet_qualifications' | 'slug'> | null;
};

export async function getAmee(): Promise<AmeeProfile | null> {
  if (!supabaseConfigured()) return null;

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, city, teacher:teacher_profiles!teacher_profiles_profile_id_fkey(id, bio, specializations, sangeet_qualifications, slug)')
      .eq('is_owner', true)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as unknown as { id: string; full_name: string; avatar_url: string | null; city: string | null; teacher: AmeeProfile['teacher'][] | AmeeProfile['teacher'] | null };
    const teacher = Array.isArray(row.teacher) ? (row.teacher[0] ?? null) : (row.teacher ?? null);
    return { id: row.id, full_name: row.full_name, avatar_url: row.avatar_url, city: row.city, teacher };
  } catch {
    return null;
  }
}
