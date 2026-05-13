import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { HolidayManager } from '@/components/enrollments/HolidayManager';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Holidays — Naadvidya' };

export default async function TeacherHolidaysPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/holidays');
  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) redirect('/dashboard');

  const today = new Date().toISOString().slice(0, 10);
  const { data: holidays } = await supabase
    .from('teacher_holidays')
    .select('holiday_date, reason')
    .eq('teacher_id', teacher.id)
    .gte('holiday_date', today)
    .order('holiday_date', { ascending: true })
    .returns<{ holiday_date: string; reason: string | null }[]>();

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}><button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button></form>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>
        <div className="mt-4 mb-6">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Availability</p>
          <h1 className="font-display text-4xl text-maroon">Holidays</h1>
          <p className="text-muted-warm mt-2 text-sm">
            Mark days you won&rsquo;t teach. Bulk-scheduling for Gurukul Paths skips these dates.
            Per policy, mark holidays at least 7 days in advance; a holiday added &lt; 48h before
            a confirmed session counts as a teacher cancellation.
          </p>
        </div>
        <HolidayManager initial={holidays ?? []} />
      </main>
    </div>
  );
}
