import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { notifyBookingCancelledByTeacher } from '@/lib/notifications';

// Cancel a booking. Caller can be the student OR the teacher of this booking.
//
// Credit-refund policy (CANCELLATION_REFUND_POLICY.md §2.1 + §3.1):
// - Phase 1 simplification: always refund 1 credit when status is pending/confirmed.
// - Goodwill credits + tiered teacher-cancellation rules go in Phase 1.5.
// - Trial bookings (is_trial=true) never debited a credit, so never refund one.

interface BookingRow {
  id: string;
  student_id: string;
  status: string;
  is_trial: boolean;
  credits_deducted: number;
  teacher: { profile_id: string };
}

interface Body {
  reason?: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body = {};
  try { body = await req.json(); } catch { /* no body is fine */ }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, student_id, status, is_trial, credits_deducted, teacher:teacher_profiles!bookings_teacher_id_fkey(profile_id)')
    .eq('id', params.id)
    .maybeSingle<BookingRow>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const isStudent = booking.student_id === user.id;
  const isTeacher = booking.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return NextResponse.json({ error: `Booking is already ${booking.status}` }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Refund credit if applicable.
  if (!booking.is_trial && booking.credits_deducted > 0) {
    const { error: rpcErr } = await admin.rpc('apply_credit_change', {
      p_student_id: booking.student_id,
      p_type: 'refund',
      p_credits: booking.credits_deducted,
      p_booking_id: booking.id,
      p_note: `Cancelled by ${isStudent ? 'student' : 'teacher'}${body.reason ? `: ${body.reason}` : ''}`,
    });
    if (rpcErr) {
      console.error('[bookings/cancel] refund failed:', rpcErr);
      return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
    }
  }

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_reason: body.reason ?? null,
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', booking.id);

  if (updateErr) {
    return NextResponse.json({ error: `Cancellation failed: ${updateErr.message}` }, { status: 500 });
  }

  // If a payout record exists for this booking, void it (mark as held — Amee reviews).
  await admin
    .from('payouts')
    .update({ status: 'held' })
    .eq('booking_id', booking.id)
    .eq('status', 'pending');

  // Notify the affected party (student when teacher cancels).
  if (isTeacher) {
    try {
      const [{ data: studentProfile }, { data: bookingDetail }] = await Promise.all([
        admin
          .from('profiles')
          .select('full_name, email, whatsapp_number, whatsapp_opted_in')
          .eq('id', booking.student_id)
          .maybeSingle<{ full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean }>(),
        admin
          .from('bookings')
          .select('scheduled_at, teacher:teacher_profiles!bookings_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name))')
          .eq('id', booking.id)
          .maybeSingle<{ scheduled_at: string | null; teacher: { profile: { full_name: string } } }>(),
      ]);
      if (studentProfile && bookingDetail?.scheduled_at && bookingDetail.teacher?.profile) {
        await notifyBookingCancelledByTeacher({
          student: {
            email: studentProfile.email,
            fullName: studentProfile.full_name,
            whatsappNumber: studentProfile.whatsapp_number,
            whatsappOptedIn: studentProfile.whatsapp_opted_in,
          },
          teacherName: bookingDetail.teacher.profile.full_name,
          scheduledAt: new Date(bookingDetail.scheduled_at),
        });
      }
    } catch (e) {
      console.error('[bookings/cancel] notification failed:', e);
    }
  }

  return NextResponse.json({ id: booking.id, status: 'cancelled' });
}
