import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProfileEditor } from '@/components/teacher/ProfileEditor';
import { AvailabilityEditor } from '@/components/teacher/AvailabilityEditor';
import { PayoutDetailsForm } from '@/components/teacher/PayoutDetailsForm';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Profile & availability — Naadvidya' };

interface TeacherRow {
  id: string;
  bio: string | null;
  years_experience: number;
  sangeet_qualifications: string[];
  specializations: string[];
  ragas_taught: string[];
  languages: string[];
  gharana: string | null;
  gurus: string[];
  instruments: string[];
  student_levels: string[];
  session_fee_inr: number;
  intro_video_url: string | null;
  auto_confirm: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  is_visible: boolean;
  slug: string | null;
}

interface AvailabilityRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
}

export default async function TeacherProfilePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/profile');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; role: string }>();
  if (profile?.role !== 'teacher' && profile?.role !== 'owner_admin') redirect('/dashboard');

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, bio, years_experience, sangeet_qualifications, specializations, ragas_taught, languages, gharana, gurus, instruments, student_levels, session_fee_inr, intro_video_url, auto_confirm, approval_status, is_visible, slug')
    .eq('profile_id', user.id)
    .maybeSingle<TeacherRow>();

  if (!teacher) redirect('/teacher/dashboard');

  const { data: slots } = await supabase
    .from('teacher_availability')
    .select('id, day_of_week, start_time, end_time, timezone, is_active')
    .eq('teacher_id', teacher.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
    .returns<AvailabilityRow[]>();

  const { data: payout } = await supabase
    .from('teacher_payout_details')
    .select('payout_method, upi_id, bank_account_name, bank_account_number, bank_ifsc')
    .eq('teacher_id', teacher.id)
    .maybeSingle<{ payout_method: 'upi' | 'bank' | null; upi_id: string | null; bank_account_name: string | null; bank_account_number: string | null; bank_ifsc: string | null }>();

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teacher/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Your profile</p>
          <h1 className="font-display text-4xl text-maroon">{profile.full_name}</h1>
          {teacher.approval_status === 'pending' && (
            <p className="mt-2 text-sm text-muted-warm">
              Profile is pending Amee&rsquo;s approval. Complete it well — that&rsquo;s what she reviews.
            </p>
          )}
          {teacher.approval_status === 'approved' && teacher.slug && (
            <p className="mt-2 text-sm text-muted-warm">
              Live at <Link href={`/teachers/${teacher.slug}`} className="text-maroon-mid hover:underline">/teachers/{teacher.slug}</Link>
            </p>
          )}
        </div>

        <section className="mb-12">
          <h2 className="font-display text-2xl text-maroon mb-4">About</h2>
          <ProfileEditor initial={teacher} />
        </section>

        <section className="mb-12">
          <h2 className="font-display text-2xl text-maroon mb-2">Availability</h2>
          <p className="text-sm text-muted-warm mb-4">
            Maintain at least 4 bookable slots per week to stay active on the platform.
            Slot times are interpreted in IST.
          </p>
          <AvailabilityEditor initial={slots ?? []} />
        </section>

        <section id="payout" className="scroll-mt-20">
          <h2 className="font-display text-2xl text-maroon mb-2">Payout details</h2>
          <p className="text-sm text-muted-warm mb-4">
            Where Naadvidya sends your 80% share. {!payout?.payout_method && <span className="text-maroon-mid">Add this so you can be paid.</span>}
          </p>
          <PayoutDetailsForm initial={payout ?? null} />
        </section>
      </main>
    </div>
  );
}
