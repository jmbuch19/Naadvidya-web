import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { VideoRoom } from '@/components/video-room/VideoRoom';
import { CompleteButton } from '@/components/video-room/CompleteButton';
import { logoutAction } from '../../(auth)/actions';

interface PageProps {
  params: { bookingId: string };
}

interface BookingRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  daily_room_url: string | null;
  student_id: string;
  notes_to_teacher: string | null;
  teacher: {
    profile_id: string;
    profile: { full_name: string };
  };
  student: { full_name: string };
}

export const metadata = { title: 'Session room — Naadvidya' };

export default async function SessionPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/session/${params.bookingId}`);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, duration_minutes, is_trial, daily_room_url,
      student_id, notes_to_teacher,
      teacher:teacher_profiles!bookings_teacher_id_fkey(
        profile_id,
        profile:profiles!teacher_profiles_profile_id_fkey(full_name)
      ),
      student:profiles!bookings_student_id_fkey(full_name)
    `)
    .eq('id', params.bookingId)
    .maybeSingle<BookingRow>();

  if (!booking) notFound();

  const isStudent = booking.student_id === user.id;
  const isTeacher = booking.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) {
    redirect('/dashboard');
  }

  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return (
      <div className="min-h-screen bg-parchment">
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="font-display text-3xl text-maroon mb-2">Session not active</h1>
          <p className="text-muted-warm">This booking is currently {booking.status}. The room opens once the teacher confirms.</p>
          <div className="mt-6">
            <Link href={isTeacher ? '/teacher/dashboard' : '/dashboard'} className="btn-primary">
              Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const otherParty = isTeacher ? booking.student.full_name : booking.teacher.profile.full_name;
  const scheduledLabel = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time TBD';

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href={isTeacher ? '/teacher/dashboard' : '/dashboard'} className="text-muted-warm hover:text-maroon-mid">
              Dashboard
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">
              {booking.is_trial ? 'Free trial session' : 'Session'}
              {booking.status === 'completed' && ' · Completed'}
            </p>
            <h1 className="font-display text-3xl text-maroon">
              With {otherParty}
            </h1>
            <p className="text-muted-warm">{scheduledLabel} · {booking.duration_minutes} minutes</p>
          </div>
          {isTeacher && booking.status === 'confirmed' && (
            <CompleteButton bookingId={booking.id} />
          )}
        </div>

        {booking.notes_to_teacher && isTeacher && (
          <div className="bg-parchment-2 border border-line rounded-lg p-4 mb-6">
            <p className="text-xs text-gold uppercase tracking-widest mb-1">Student note</p>
            <p className="text-ink whitespace-pre-line">{booking.notes_to_teacher}</p>
          </div>
        )}

        {booking.status === 'completed' ? (
          <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center">
            <p className="font-display text-2xl text-maroon mb-2">Session complete</p>
            <p className="text-muted-warm">
              {isTeacher ? 'Consider posting an assignment for your student.' : 'Look out for your guru’s assignment in your homework inbox.'}
            </p>
          </div>
        ) : booking.daily_room_url ? (
          <VideoRoom
            bookingId={booking.id}
            roomUrl={booking.daily_room_url}
            isTeacher={isTeacher}
          />
        ) : (
          <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center text-muted-warm">
            Room URL missing — please refresh, or contact support.
          </div>
        )}
      </main>
    </div>
  );
}
