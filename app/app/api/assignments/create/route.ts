import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyAssignmentPosted } from '@/lib/notifications';

// Teacher creates an assignment, optionally linked to a completed booking.
// RLS on assignments enforces: teacher_id must be in caller's teacher_profiles.

interface Body {
  bookingId?: string | null;
  studentId?: string;          // required if bookingId not given
  title: string;
  description?: string | null;
  deliverables?: string[];
  dueBefore?: string | null;   // ISO timestamp
}

interface BookingRow {
  id: string;
  student_id: string;
  teacher_id: string;
  status: string;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }

  // Resolve teacher_id (the caller's teacher_profile id).
  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id')
    .eq('profile_id', user.id)
    .maybeSingle<{ id: string }>();
  if (!teacher) {
    return NextResponse.json({ error: 'Only teachers can create assignments' }, { status: 403 });
  }

  let studentId = body.studentId;
  const bookingId: string | null = body.bookingId ?? null;

  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, student_id, teacher_id, status')
      .eq('id', bookingId)
      .maybeSingle<BookingRow>();
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.teacher_id !== teacher.id) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }
    studentId = booking.student_id;
  }

  if (!studentId) {
    return NextResponse.json({ error: 'studentId or bookingId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      booking_id: bookingId,
      teacher_id: teacher.id,
      student_id: studentId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      deliverables: (body.deliverables ?? []).map((s) => s.trim()).filter(Boolean),
      due_before: body.dueBefore ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }

  // Notify student (best-effort).
  try {
    const admin = createServiceRoleClient();
    const [{ data: student }, { data: teacherProfile }] = await Promise.all([
      admin
        .from('profiles')
        .select('full_name, email, whatsapp_number, whatsapp_opted_in')
        .eq('id', studentId)
        .maybeSingle<{ full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean }>(),
      admin
        .from('teacher_profiles')
        .select('profile:profiles!teacher_profiles_profile_id_fkey(full_name)')
        .eq('id', teacher.id)
        .maybeSingle<{ profile: { full_name: string } }>(),
    ]);
    if (student && teacherProfile?.profile) {
      await notifyAssignmentPosted({
        student: {
          email: student.email,
          fullName: student.full_name,
          whatsappNumber: student.whatsapp_number,
          whatsappOptedIn: student.whatsapp_opted_in,
        },
        teacherName: teacherProfile.profile.full_name,
        assignmentTitle: body.title.trim(),
        dueBefore: body.dueBefore ? new Date(body.dueBefore) : null,
      });
    }
  } catch (e) {
    console.error('[assignments/create] notification failed:', e);
  }

  return NextResponse.json({ id: data.id });
}
