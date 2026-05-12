import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { presignRead, isR2Configured } from '@/lib/r2';
import { VoiceRepoPlayer, type VoiceRepoItem } from '@/components/voice-repo/VoiceRepoPlayer';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Voice Repo — Naadvidya' };

interface RepoRow extends VoiceRepoItem {
  collection_id: string | null;
}

export default async function StudentVoiceRepoPage({ params }: { params: { teacherId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=/voice-repo/${params.teacherId}`);

  const { data: teacher } = await supabase
    .from('teacher_profiles')
    .select('id, slug, is_visible, profile:profiles!teacher_profiles_profile_id_fkey(full_name)')
    .eq('id', params.teacherId)
    .maybeSingle<{ id: string; slug: string | null; is_visible: boolean; profile: { full_name: string } }>();
  if (!teacher) notFound();

  // RLS does the access control: a non-booked student sees only the public sample;
  // a booked student (status confirmed/completed) sees everything; the teacher sees their own.
  const { data: recordings } = await supabase
    .from('voice_repo')
    .select('id, title, description, raga, taal, category, level_min, level_max, duration_seconds, notes_text, notes_pdf_key, notes_pdf_url, is_public_sample, collection_id, is_active')
    .eq('teacher_id', teacher.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<RepoRow[]>();

  const all = recordings ?? [];
  // Determine if the student has full access: if they got back more than just the public sample,
  // OR there's no public sample but they still got rows, they're a booked student.
  const onlyPublicSample = all.length > 0 && all.every((r) => r.is_public_sample);
  const hasFullAccess = all.length > 0 && !onlyPublicSample;

  // Has this student ever booked this teacher? (used for the gating message)
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('student_id', user.id)
    .eq('teacher_id', teacher.id)
    .in('status', ['confirmed', 'completed'])
    .limit(1)
    .maybeSingle();
  const isBooked = !!booking;

  if (isR2Configured()) {
    await Promise.all(all.map(async (r) => {
      if (r.notes_pdf_key) { try { (r as RepoRow).notes_pdf_url = await presignRead(r.notes_pdf_key); } catch { /* */ } }
    }));
  }

  const byCollection = new Map<string, RepoRow[]>();
  const unfiled: RepoRow[] = [];
  for (const r of all) {
    if (r.collection_id) {
      const arr = byCollection.get(r.collection_id) ?? [];
      arr.push(r); byCollection.set(r.collection_id, arr);
    } else unfiled.push(r);
  }
  // Fetch collection titles for the ones present
  const collIds = Array.from(byCollection.keys());
  let collTitles: Record<string, string> = {};
  if (collIds.length) {
    const { data: cs } = await supabase.from('voice_repo_collections').select('id, title').in('id', collIds).returns<{ id: string; title: string }[]>();
    collTitles = Object.fromEntries((cs ?? []).map((c) => [c.id, c.title]));
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {teacher.slug && (
          <Link href={`/teachers/${teacher.slug}`} className="text-sm text-muted-warm hover:text-maroon-mid">← {teacher.profile.full_name}&rsquo;s profile</Link>
        )}
        <div className="mt-4 mb-8">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Reference recordings</p>
          <h1 className="font-display text-4xl text-maroon">{teacher.profile.full_name}&rsquo;s Voice Repo</h1>
        </div>

        {!isBooked && !hasFullAccess && (
          <div className="mb-8 rounded-lg border border-gold/40 bg-parchment-2 p-5">
            <p className="text-ink">
              You can hear {teacher.profile.full_name}&rsquo;s public sample below. Book a session to unlock
              the full library — phrases, alankaars, bandish renderings, and corrections you can replay
              between classes.
            </p>
            {teacher.slug && (
              <div className="mt-3 flex gap-3">
                <Link href={`/book/${teacher.id}`} className="btn-primary">Request a session</Link>
                <Link href={`/book/${teacher.id}?trial=1`} className="btn-ghost">Free 15-min trial</Link>
              </div>
            )}
          </div>
        )}

        {all.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-8 text-center text-muted-warm">
            {teacher.profile.full_name} hasn&rsquo;t added any recordings yet.
          </div>
        ) : (
          <div className="space-y-10">
            {collIds.map((cid) => {
              const items = byCollection.get(cid) ?? [];
              if (!items.length) return null;
              return (
                <section key={cid}>
                  <h2 className="font-display text-2xl text-maroon mb-3">{collTitles[cid] ?? 'Collection'}</h2>
                  <div className="space-y-3">{items.map((r) => <VoiceRepoPlayer key={r.id} item={r} />)}</div>
                </section>
              );
            })}
            {unfiled.length > 0 && (
              <section>
                {collIds.length > 0 && <h2 className="font-display text-2xl text-maroon mb-3">More</h2>}
                <div className="space-y-3">{unfiled.map((r) => <VoiceRepoPlayer key={r.id} item={r} />)}</div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
