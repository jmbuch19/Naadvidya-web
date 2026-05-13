import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ScheduledVideoRoom } from '@/components/video-room/ScheduledVideoRoom';
import { SessionCompleteButton } from '@/components/enrollments/SessionCompleteButton';
import { FloatingToolsButton } from '@/components/plugins/FloatingToolsButton';
import { logoutAction } from '../../../(auth)/actions';

interface PageProps { params: { scheduledSessionId: string } }

interface Row {
  id: string; status: string; scheduled_at: string; duration_minutes: number;
  session_number: number | null; student_id: string;
  teacher: { profile_id: string; profile: { full_name: string } };
  student: { full_name: string };
  enrollment: { offering: { title: string; offering_type: string } } | null;
}

export const metadata = { title: 'Session — Naadvidya' };

export default async function ScheduledSessionPage({ params }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/session/s/${params.scheduledSessionId}`);

  const { data: s } = await supabase
    .from('scheduled_sessions')
    .select(`
      id, status, scheduled_at, duration_minutes, session_number, student_id,
      teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile_id, profile:profiles!teacher_profiles_profile_id_fkey(full_name)),
      student:profiles!scheduled_sessions_student_id_fkey(full_name),
      enrollment:enrollments!scheduled_sessions_enrollment_id_fkey(offering:class_offerings!enrollments_offering_id_fkey(title, offering_type))
    `)
    .eq('id', params.scheduledSessionId)
    .maybeSingle<Row>();
  if (!s) notFound();

  const isStudent = s.student_id === user.id;
  const isTeacher = s.teacher.profile_id === user.id;
  if (!isStudent && !isTeacher) redirect('/dashboard');

  const dashHref = isTeacher ? '/teacher/dashboard' : '/dashboard';
  const other = isTeacher ? s.student.full_name : s.teacher.profile.full_name;
  const when = new Date(s.scheduled_at).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const offeringTitle = s.enrollment?.offering?.title;

  if (s.status !== 'upcoming' && s.status !== 'completed') {
    return (
      <div className="min-h-screen bg-parchment">
        <main className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="font-display text-3xl text-maroon mb-2">Session not active</h1>
          <p className="text-muted-warm">This session is {s.status.replace('_', ' ')}.</p>
          <div className="mt-6"><Link href={dashHref} className="btn-primary">Back to dashboard</Link></div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href={dashHref} className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
          <div>
            <p className="text-sm text-gold uppercase tracking-widest mb-1">
              {offeringTitle ? `${offeringTitle}` : 'Session'}{s.session_number ? ` · Session ${s.session_number}` : ''}{s.status === 'completed' ? ' · Completed' : ''}
            </p>
            <h1 className="font-display text-3xl text-maroon">With {other}</h1>
            <p className="text-muted-warm">{when} · {s.duration_minutes} minutes</p>
          </div>
          {isTeacher && s.status === 'upcoming' && <SessionCompleteButton sessionId={s.id} />}
        </div>

        {s.status === 'completed' ? (
          <div className="rounded-lg border border-line bg-parchment-2 p-10 text-center">
            <p className="font-display text-2xl text-maroon mb-2">Session complete</p>
            <p className="text-muted-warm">{isTeacher ? 'Consider posting an assignment.' : 'Look out for your guru’s assignment in your homework inbox.'}</p>
          </div>
        ) : (
          <ScheduledVideoRoom sessionId={s.id} isTeacher={isTeacher} />
        )}
      </main>

      {s.status === 'upcoming' && <FloatingToolsButton />}
    </div>
  );
}
