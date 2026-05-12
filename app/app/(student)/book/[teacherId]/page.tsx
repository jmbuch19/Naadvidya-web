import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { generateSlots, type AvailabilityRow } from '@/lib/availability';
import { SlotPicker } from '@/components/book/SlotPicker';
import { logoutAction } from '../../../(auth)/actions';

interface PageProps {
  params: { teacherId: string };
  searchParams: { trial?: string };
}

interface TeacherRow {
  id: string;
  session_fee_inr: number;
  is_visible: boolean;
  profile: { id: string; full_name: string; is_owner: boolean };
}

export const metadata = { title: 'Book a session — Naadvidya' };

export default async function BookPage({ params, searchParams }: PageProps) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/book/${params.teacherId}`);

  const wantsTrial = searchParams.trial === '1';

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, session_fee_inr, is_visible, profile:profiles!teacher_profiles_profile_id_fkey(id, full_name, is_owner)')
    .eq('id', params.teacherId)
    .eq('is_visible', true)
    .maybeSingle<TeacherRow>();

  if (!teacher) notFound();

  // Trial guard: max one trial per (student, teacher) pair.
  let trialBlocked = false;
  if (wantsTrial) {
    const { data: existingTrial } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('student_id', user.id)
      .eq('teacher_id', teacher.id)
      .eq('is_trial', true)
      .maybeSingle<{ id: string; status: string }>();
    if (existingTrial) trialBlocked = true;
  }

  const { data: availability } = await supabase
    .from('teacher_availability')
    .select('day_of_week, start_time, end_time, timezone, is_active')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true)
    .returns<AvailabilityRow[]>();

  const { data: creditsRow } = await supabase
    .from('student_credits')
    .select('credits_balance')
    .eq('student_id', user.id)
    .maybeSingle<{ credits_balance: number }>();

  const balance = creditsRow?.credits_balance ?? 0;
  const slots = generateSlots({
    availability: availability ?? [],
    days: 14,
    chunkMinutes: wantsTrial ? 15 : 60,
  });

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href={`/teachers/${teacher.id}`} className="text-sm text-muted-warm hover:text-maroon-mid">← Back to teacher</Link>

        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">
            {wantsTrial ? 'Free 15-minute trial' : 'Request a session'}
          </p>
          <h1 className="font-display text-3xl text-maroon">
            With {teacher.profile.full_name}
          </h1>
          {wantsTrial ? (
            <p className="mt-2 text-muted-warm">
              A complimentary 15-minute introduction. One per teacher. No credit cost.
            </p>
          ) : (
            <p className="mt-2 text-muted-warm">
              60-minute session · ₹{Math.round(teacher.session_fee_inr)} · 1 credit
            </p>
          )}
        </div>

        {trialBlocked ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-6">
            <h2 className="font-display text-xl text-maroon mb-2">Trial already used</h2>
            <p className="text-muted-warm">
              You&rsquo;ve already booked a free trial with this teacher. Book a regular session
              to continue learning.
            </p>
            <div className="mt-4">
              <Link href={`/book/${teacher.id}`} className="btn-primary">Book a paid session</Link>
            </div>
          </div>
        ) : !wantsTrial && balance < 1 ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-6">
            <h2 className="font-display text-xl text-maroon mb-2">No credits available</h2>
            <p className="text-muted-warm">
              You need at least 1 credit to book a session. Buy a credit pack to begin.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/credits" className="btn-primary">Buy credits</Link>
              <Link href={`/book/${teacher.id}?trial=1`} className="btn-ghost">Try a free 15-min trial</Link>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-6">
            <h2 className="font-display text-xl text-maroon mb-2">No slots available</h2>
            <p className="text-muted-warm">
              This teacher hasn&rsquo;t published bookable slots for the next two weeks.
              Please check back soon.
            </p>
          </div>
        ) : (
          <SlotPicker
            teacherId={teacher.id}
            slots={slots}
            isTrial={wantsTrial}
          />
        )}
      </main>
    </div>
  );
}
