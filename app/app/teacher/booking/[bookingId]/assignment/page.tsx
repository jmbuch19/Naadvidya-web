import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AssignmentForm } from '@/components/teacher/AssignmentForm';
import { logoutAction } from '../../../../(auth)/actions';

interface PageProps {
  params: { bookingId: string };
}

interface BookingRow {
  id: string;
  status: string;
  scheduled_at: string | null;
  student_id: string;
  student: { full_name: string };
  teacher: { profile_id: string };
}

export const metadata = { title: 'Post assignment — Naadvidya' };

export default async function NewAssignmentPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/teacher/booking/${params.bookingId}/assignment`);

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, scheduled_at, student_id,
      student:profiles!bookings_student_id_fkey(full_name),
      teacher:teacher_profiles!bookings_teacher_id_fkey(profile_id)
    `)
    .eq('id', params.bookingId)
    .maybeSingle<BookingRow>();

  if (!booking) notFound();
  if (booking.teacher.profile_id !== user.id) redirect('/teacher/dashboard');

  // Check for existing assignment to avoid duplicates
  const { data: existing } = await supabase
    .from('assignments')
    .select('id, title')
    .eq('booking_id', booking.id)
    .maybeSingle<{ id: string; title: string }>();

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Back</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Assignment</p>
          <h1 className="font-display text-3xl text-maroon">For {booking.student.full_name}</h1>
          {booking.scheduled_at && (
            <p className="text-sm text-muted-warm mt-1">
              From session on{' '}
              {new Date(booking.scheduled_at).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'short',
              })}
            </p>
          )}
        </div>

        {existing ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-6">
            <h2 className="font-display text-xl text-maroon mb-2">Assignment already posted</h2>
            <p className="text-muted-warm">
              You&rsquo;ve already posted &ldquo;{existing.title}&rdquo; for this session.
            </p>
            <div className="mt-4">
              <Link href={`/teacher/homework`} className="btn-primary">View homework inbox</Link>
            </div>
          </div>
        ) : (
          <AssignmentForm bookingId={booking.id} studentName={booking.student.full_name} />
        )}
      </main>
    </div>
  );
}
