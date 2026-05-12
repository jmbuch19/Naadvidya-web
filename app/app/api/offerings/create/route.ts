import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWorkshopSchedule, type OfferingType } from '@/lib/offerings';

// Teacher creates a class offering (Workshop / Gurukul Programme / Mehfil series).
// Goes in as approval_status='pending', is_visible=false — Amee approves it like a
// teacher profile. RLS ensures teacher_id belongs to the caller.

const TYPES: OfferingType[] = ['gurukul_path', 'riyaaz_workshop', 'mehfil_session'];

interface Body {
  offeringType: OfferingType;
  title: string;
  description?: string | null;
  minLevel?: number;
  maxLevel?: number;
  specialization?: string | null;
  sessionsPerWeek?: number;
  totalSessions?: number | null;
  durationWeeks?: number | null;
  pricePerSessionInr: number;
  maxStudents?: number;
  prerequisites?: string | null;
  curriculumOutline?: string | null;
  // Workshop scheduling (ignored for gurukul):
  startDate?: string | null;          // 'YYYY-MM-DD'
  daysOfWeek?: number[];
  time?: string;                       // 'HH:MM'
}

function clampLevel(n: unknown): number {
  const v = typeof n === 'number' ? Math.floor(n) : 0;
  return Math.max(0, Math.min(7, v));
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id, approval_status').eq('profile_id', user.id).maybeSingle<{ id: string; approval_status: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });
  if (teacher.approval_status !== 'approved') {
    return NextResponse.json({ error: 'Your teacher profile must be approved before creating offerings.' }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!TYPES.includes(body.offeringType)) return NextResponse.json({ error: 'invalid offeringType' }, { status: 400 });
  if (typeof body.pricePerSessionInr !== 'number' || body.pricePerSessionInr < 0) {
    return NextResponse.json({ error: 'pricePerSessionInr must be a non-negative number' }, { status: 400 });
  }

  const minLevel = clampLevel(body.minLevel ?? 0);
  const maxLevel = clampLevel(body.maxLevel ?? 7);
  if (maxLevel < minLevel) return NextResponse.json({ error: 'maxLevel must be >= minLevel' }, { status: 400 });

  const totalSessions = body.totalSessions && body.totalSessions > 0 ? Math.floor(body.totalSessions) : null;

  // Workshops: build the concrete session schedule now.
  let sessionSchedule: string[] = [];
  if (body.offeringType === 'riyaaz_workshop') {
    if (!totalSessions) return NextResponse.json({ error: 'A workshop needs a session count (total_sessions).' }, { status: 400 });
    if (!body.startDate || !body.daysOfWeek?.length || !body.time) {
      return NextResponse.json({ error: 'A workshop needs a start date, recurring day(s), and a time.' }, { status: 400 });
    }
    sessionSchedule = generateWorkshopSchedule({
      startDate: body.startDate, daysOfWeek: body.daysOfWeek, time: body.time, count: totalSessions,
    });
    if (sessionSchedule.length < totalSessions) {
      return NextResponse.json({ error: 'Could not generate enough session dates — check the start date and recurring days.' }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('class_offerings')
    .insert({
      teacher_id: teacher.id,
      offering_type: body.offeringType,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      min_level: minLevel,
      max_level: maxLevel,
      specialization: body.specialization?.trim() || null,
      sessions_per_week: Math.max(1, Math.min(7, Math.floor(body.sessionsPerWeek ?? 2))),
      total_sessions: totalSessions,
      duration_weeks: body.durationWeeks && body.durationWeeks > 0 ? Math.floor(body.durationWeeks) : null,
      price_per_session_inr: body.pricePerSessionInr,
      max_students: Math.max(1, Math.floor(body.maxStudents ?? 1)),
      prerequisites: body.prerequisites?.trim() || null,
      curriculum_outline: body.curriculumOutline?.trim() || null,
      start_date: body.offeringType === 'riyaaz_workshop' ? body.startDate : null,
      session_schedule: sessionSchedule,
      is_active: true,
      is_visible: false,
      approval_status: 'pending',
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
