import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyNewBookingRequest } from '@/lib/notifications';

// Student creates a booking. Sequence:
//   1. Verify auth + load student credits.
//   2. If trial: verify no prior trial with this teacher.
//   3. If paid: verify credits_balance >= 1.
//   4. Insert booking (status: pending).
//   5. Deduct credit via apply_credit_change (skipped for trials).
//   6. Email teacher (best-effort).
//
// Daily.co room creation happens in /api/bookings/[id]/confirm — see Daily.co
// rooms have an expiry, so we only create them once the teacher accepts.

interface Body {
  teacherId: string;
  scheduledAt: string;        // ISO string
  isTrial?: boolean;
  notesToTeacher?: string | null;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.teacherId || !body.scheduledAt) {
    return NextResponse.json({ error: 'teacherId and scheduledAt required' }, { status: 400 });
  }

  const scheduledAt = new Date(body.scheduledAt);
  if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return NextResponse.json({ error: 'scheduledAt must be a future ISO timestamp' }, { status: 400 });
  }

  // Re-verify the teacher exists and is visible.
  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, is_visible')
    .eq('id', body.teacherId)
    .eq('is_visible', true)
    .maybeSingle<{ id: string; is_visible: boolean }>();

  if (!teacher) {
    return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
  }

  const isTrial = body.isTrial === true;

  if (isTrial) {
    // Enforce one-trial-per-pair (DB has a partial unique index too — this is a friendly check).
    const { data: existingTrial } = await supabase
      .from('bookings')
      .select('id')
      .eq('student_id', user.id)
      .eq('teacher_id', teacher.id)
      .eq('is_trial', true)
      .maybeSingle();
    if (existingTrial) {
      return NextResponse.json({ error: 'You have already used your free trial with this teacher.' }, { status: 409 });
    }
  } else {
    const { data: credits } = await supabase
      .from('student_credits')
      .select('credits_balance')
      .eq('student_id', user.id)
      .maybeSingle<{ credits_balance: number }>();
    if (!credits || credits.credits_balance < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
  }

  // Insert booking (RLS: student inserts own).
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      student_id: user.id,
      teacher_id: teacher.id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: isTrial ? 15 : 60,
      is_trial: isTrial,
      credits_deducted: isTrial ? 0 : 1,
      notes_to_teacher: body.notesToTeacher ?? null,
      status: 'pending',
    })
    .select('id')
    .single<{ id: string }>();

  if (bookingErr || !booking) {
    return NextResponse.json({ error: bookingErr?.message ?? 'Booking insert failed' }, { status: 500 });
  }

  // Deduct credit atomically via SECURITY DEFINER function (skips RLS).
  if (!isTrial) {
    const admin = createServiceRoleClient();
    const { error: rpcErr } = await admin.rpc('apply_credit_change', {
      p_student_id: user.id,
      p_type: 'debit',
      p_credits: 1,
      p_booking_id: booking.id,
      p_note: 'Session booking',
    });
    if (rpcErr) {
      // Roll back the booking — can't deduct credit
      await admin.from('bookings').delete().eq('id', booking.id);
      return NextResponse.json({ error: `Credit deduction failed: ${rpcErr.message}` }, { status: 500 });
    }
  }

  // Notify teacher (best-effort; never block the response).
  try {
    const admin = createServiceRoleClient();
    const [{ data: teacherProfile }, { data: studentProfile }] = await Promise.all([
      admin
        .from('teacher_profiles')
        .select('profile:profiles!teacher_profiles_profile_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in)')
        .eq('id', teacher.id)
        .maybeSingle<{ profile: { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean } }>(),
      admin
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle<{ full_name: string }>(),
    ]);
    if (teacherProfile?.profile && studentProfile) {
      await notifyNewBookingRequest({
        teacher: {
          email: teacherProfile.profile.email,
          fullName: teacherProfile.profile.full_name,
          whatsappNumber: teacherProfile.profile.whatsapp_number,
          whatsappOptedIn: teacherProfile.profile.whatsapp_opted_in,
        },
        studentName: studentProfile.full_name,
        scheduledAt,
        isTrial,
      });
    }
  } catch (e) {
    console.error('[bookings/create] notification failed:', e);
  }

  return NextResponse.json({ id: booking.id, status: 'pending' });
}
