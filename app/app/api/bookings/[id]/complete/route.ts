import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Teacher marks a confirmed session as complete. Side effects:
//   1. booking.status → 'completed', completed_at set.
//   2. Payout record stays in 'pending' (Amee marks paid manually on 1st/15th).
//      Already inserted on confirm — no need to re-insert.
//   3. No credit refund (the session happened).
//   4. Email student (deferred) + remind to leave a session note in Phase 1.5.

interface BookingRow {
  id: string;
  status: string;
  teacher: { profile_id: string };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, teacher:teacher_profiles!bookings_teacher_id_fkey(profile_id)')
    .eq('id', params.id)
    .maybeSingle<BookingRow>();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.teacher.profile_id !== user.id) {
    return NextResponse.json({ error: 'Only the teacher can mark complete' }, { status: 403 });
  }
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: `Booking is ${booking.status}, cannot complete` }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('bookings')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', booking.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: booking.id, status: 'completed' });
}
