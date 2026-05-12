// Public reads for class offerings (anon client + RLS — only approved + visible rows).

import { createAnonClient } from './anon';
import type { OfferingType } from '@/lib/offerings';

function configured() {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export interface PublicOffering {
  id: string;
  offering_type: OfferingType;
  title: string;
  description: string | null;
  min_level: number;
  max_level: number;
  specialization: string | null;
  sessions_per_week: number;
  total_sessions: number | null;
  duration_weeks: number | null;
  price_per_session_inr: number;
  max_students: number;
  prerequisites: string | null;
  curriculum_outline: string | null;
  start_date: string | null;
  session_schedule: string[] | null;
  teacher: {
    id: string;
    slug: string | null;
    profile: { full_name: string; avatar_url: string | null };
  };
}

const SELECT =
  'id, offering_type, title, description, min_level, max_level, specialization, sessions_per_week, total_sessions, duration_weeks, price_per_session_inr, max_students, prerequisites, curriculum_outline, start_date, session_schedule, teacher:teacher_profiles!class_offerings_teacher_id_fkey(id, slug, profile:profiles!teacher_profiles_profile_id_fkey(full_name, avatar_url))';

export async function getPublicOfferings(opts?: { type?: OfferingType }): Promise<PublicOffering[]> {
  if (!configured()) return [];
  try {
    const supabase = createAnonClient();
    let q = supabase
      .from('class_offerings')
      .select(SELECT)
      .eq('is_visible', true)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (opts?.type) q = q.eq('offering_type', opts.type);
    const { data, error } = await q;
    if (error) { console.warn('[offerings-queries] list failed:', error.message); return []; }
    return (data ?? []) as unknown as PublicOffering[];
  } catch (e) { console.warn('[offerings-queries] list exception:', e); return []; }
}

export async function getPublicOffering(id: string): Promise<PublicOffering | null> {
  if (!configured()) return null;
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from('class_offerings')
      .select(SELECT)
      .eq('id', id)
      .eq('is_visible', true)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data) return null;
    return data as unknown as PublicOffering;
  } catch { return null; }
}
