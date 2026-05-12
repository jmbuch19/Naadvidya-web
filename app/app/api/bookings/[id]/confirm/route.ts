import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { createDailyRoom, isDailyConfigured } from '@/lib/daily';
import { notifyBookingConfirmed } from '@/lib/notifications';

// Teacher confirms a pending booking. Side effects:
//   1. Verify the caller is the teacher on this booking.
//   2. Create a Daily.co private room (lazy — at confirm time, not request time).
//   3. Update booking → status: confirmed, daily_room_*.
//   4. Create payout record (80/20 split, 100% if is_owner).
//   5. Email student (deferred).

interface BookingDetail {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  teacher: {
    id: string;
    profile_id: string;
    session_fee_inr: number;
    profile: { is_owner: boolean };
  };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, is_trial,
      teacher:teacher_profiles!bookings_teacher_id_fkey (
        id, profile_id, session_fee_inr,
        profile:profiles!teacher_profiles_profile_id_fkey ( is_owner )
      )
    `)
    .eq('id', params.id)
    .maybeSingle<BookingDetail>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.teacher.profile_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: `Booking is ${booking.status}, cannot confirm` }, { status: 400 });
  }
  if (!booking.scheduled_at) {
    return NextResponse.json({ error: 'Booking has no scheduled time' }, { status: 400 });
  }

  // Create Daily.co room. If not configured (dev), use a placeholder.
  let roomName: string;
  let roomUrl: string;
  if (isDailyConfigured()) {
    try {
      const room = await createDailyRoom({
        bookingId: booking.id,
        scheduledAt: new Date(booking.scheduled_at),
        durationMinutes: booking.duration_minutes,
      });
      roomName = room.name;
      roomUrl = room.url;
    } catch (e) {
      console.error('[bookings/confirm] Daily.co room creation failed:', e);
      return NextResponse.json({ error: 'Video room creation failed' }, { status: 502 });
    }
  } else {
    roomName = `naadvidya-${booking.id}`;
    roomUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/session/${booking.id}?mock=1`;
  }

  // Use service-role for the booking update + payout insert.
  const admin = createServiceRoleClient();

  const { error: updateErr } = await admin
    .from('bookings')
    .update({
      status: 'confirmed',
      daily_room_name: roomName,
      daily_room_url: roomUrl,
    })
    .eq('id', booking.id);

  if (updateErr) {
    return NextResponse.json({ error: `Booking update failed: ${updateErr.message}` }, { status: 500 });
  }

  // Payout record (skip for trials — they're free).
  if (!booking.is_trial) {
    const isOwnerSession = booking.teacher.profile.is_owner;
    const gross = booking.teacher.session_fee_inr;
    const platformCut = isOwnerSession ? 0 : Math.round(gross * 0.2 * 100) / 100;
    const teacherAmount = isOwnerSession ? gross : Math.round(gross * 0.8 * 100) / 100;

    const { error: payoutErr } = await admin.from('payouts').insert({
      teacher_id: booking.teacher.id,
      booking_id: booking.id,
      gross_amount: gross,
      platform_cut: platformCut,
      teacher_amount: teacherAmount,
      is_owner_session: isOwnerSession,
      status: 'pending',
    });
    if (payoutErr) {
      console.error('[bookings/confirm] payout insert failed:', payoutErr);
      // Non-fatal — Amee can fix manually if it slips
    }
  }

  // Notify student (best-effort).
  try {
    const [{ data: studentProfile }, { data: teacherFullName }] = await Promise.all([
      admin
        .from('profiles')
        .select('full_name, email, whatsapp_number, whatsapp_opted_in')
        .eq('id', (await admin.from('bookings').select('student_id').eq('id', booking.id).maybeSingle<{ student_id: string }>()).data?.student_id ?? '')
        .maybeSingle<{ full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean }>(),
      admin
        .from('teacher_profiles')
        .select('profile:profiles!teacher_profiles_profile_id_fkey(full_name)')
        .eq('id', booking.teacher.id)
        .maybeSingle<{ profile: { full_name: string } }>(),
    ]);
    if (studentProfile && teacherFullName?.profile) {
      await notifyBookingConfirmed({
        student: {
          email: studentProfile.email,
          fullName: studentProfile.full_name,
          whatsappNumber: studentProfile.whatsapp_number,
          whatsappOptedIn: studentProfile.whatsapp_opted_in,
        },
        teacherName: teacherFullName.profile.full_name,
        scheduledAt: new Date(booking.scheduled_at),
      });
    }
  } catch (e) {
    console.error('[bookings/confirm] notification failed:', e);
  }

  return NextResponse.json({ id: booking.id, status: 'confirmed' });
}
