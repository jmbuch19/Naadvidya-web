import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Body {
  bio?: string;
  years_experience?: number;
  sangeet_qualifications?: string[];
  specializations?: string[];
  ragas_taught?: string[];
  languages?: string[];
  session_fee_inr?: number;
  intro_video_url?: string | null;
  auto_confirm?: boolean;
}

const MIN_FEE = 500;
const MAX_FEE = 5000;

function clean(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 50);
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Verify caller has a teacher profile
  const { data: existing } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!existing) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.bio === 'string') updates.bio = body.bio.trim().slice(0, 4000);
  if (typeof body.years_experience === 'number' && body.years_experience >= 0) {
    updates.years_experience = Math.floor(body.years_experience);
  }
  if (body.sangeet_qualifications) updates.sangeet_qualifications = clean(body.sangeet_qualifications);
  if (body.specializations) updates.specializations = clean(body.specializations);
  if (body.ragas_taught) updates.ragas_taught = clean(body.ragas_taught);
  if (body.languages) updates.languages = clean(body.languages);
  if (typeof body.session_fee_inr === 'number') {
    if (body.session_fee_inr < MIN_FEE || body.session_fee_inr > MAX_FEE) {
      return NextResponse.json({ error: `Fee must be between ₹${MIN_FEE} and ₹${MAX_FEE}` }, { status: 400 });
    }
    updates.session_fee_inr = body.session_fee_inr;
  }
  if (body.intro_video_url !== undefined) {
    const url = body.intro_video_url?.trim();
    updates.intro_video_url = url || null;
  }
  if (typeof body.auto_confirm === 'boolean') updates.auto_confirm = body.auto_confirm;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const { error } = await supabase
    .from('teacher_profiles')
    .update(updates)
    .eq('id', existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
