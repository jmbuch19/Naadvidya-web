import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Replace-all availability for the current teacher. Simpler than diffing — the
// editor sends the complete desired set and we replace.

interface SlotInput {
  day_of_week: number;       // 0..6
  start_time: string;        // 'HH:MM'
  end_time: string;          // 'HH:MM'
  timezone?: string;
  is_active?: boolean;
}

interface Body { slots: SlotInput[] }

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teacher profile not found' }, { status: 404 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body.slots)) {
    return NextResponse.json({ error: 'slots array required' }, { status: 400 });
  }
  if (body.slots.length > 50) {
    return NextResponse.json({ error: 'Too many slots' }, { status: 400 });
  }

  // Validate each slot
  for (const s of body.slots) {
    if (typeof s.day_of_week !== 'number' || s.day_of_week < 0 || s.day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week 0-6 required' }, { status: 400 });
    }
    if (!HHMM.test(s.start_time) || !HHMM.test(s.end_time)) {
      return NextResponse.json({ error: 'start_time/end_time must be HH:MM' }, { status: 400 });
    }
    if (s.start_time >= s.end_time) {
      return NextResponse.json({ error: 'end_time must be after start_time' }, { status: 400 });
    }
  }

  // Replace-all via service-role (atomic-ish: delete then insert).
  const admin = createServiceRoleClient();
  const { error: delErr } = await admin
    .from('teacher_availability')
    .delete()
    .eq('teacher_id', teacher.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (body.slots.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const rows = body.slots.map((s) => ({
    teacher_id: teacher.id,
    day_of_week: s.day_of_week,
    start_time: s.start_time + ':00',
    end_time: s.end_time + ':00',
    timezone: s.timezone || 'Asia/Kolkata',
    is_active: s.is_active !== false,
  }));

  const { error: insErr } = await admin.from('teacher_availability').insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: rows.length });
}
