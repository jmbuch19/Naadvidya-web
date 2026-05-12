import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createMeetingToken, isDailyConfigured } from '@/lib/daily';

// Generate a per-user Daily.co meeting token for a booking. Token's `is_owner`
// flag is true for the teacher (gives them moderator rights), false for the student.

interface BookingRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  daily_room_name: string | null;
  student_id: string;
  teacher: { profile_id: string };
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { bookingId?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.bookingId) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, scheduled_at, duration_minutes, daily_room_name, student_id, teacher:teacher_profiles!bookings_teacher_id_fkey(profile_id)')
    .eq('id', body.bookingId)
    .maybeSingle<BookingRow>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const isStudent = booking.student_id === user.id;
  const isTeacher = booking.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `Booking is ${booking.status} — room not active` }, { status: 400 });
  }
  if (!booking.daily_room_name) {
    return NextResponse.json({ error: 'Daily.co room not provisioned' }, { status: 400 });
  }

  if (!isDailyConfigured()) {
    // Dev: return a placeholder token so the page still renders.
    return NextResponse.json({ token: 'mock-token-dev', mock: true });
  }

  // Get user's display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string }>();

  try {
    const scheduledAt = booking.scheduled_at ? new Date(booking.scheduled_at) : new Date();
    const expSeconds = Math.floor(scheduledAt.getTime() / 1000) + booking.duration_minutes * 60 + 3600;

    const token = await createMeetingToken({
      roomName: booking.daily_room_name,
      isTeacher,
      userName: profile?.full_name ?? (isTeacher ? 'Teacher' : 'Student'),
      expSeconds,
    });
    return NextResponse.json({ token });
  } catch (e) {
    console.error('[daily/token] failed:', e);
    return NextResponse.json({ error: 'Token generation failed' }, { status: 502 });
  }
}
