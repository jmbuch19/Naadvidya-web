import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { presignRead, isR2Configured } from '@/lib/r2';
import { VoiceRepoPlayer, type VoiceRepoItem } from '@/components/voice-repo/VoiceRepoPlayer';
import { VoiceRepoUploadForm } from '@/components/voice-repo/VoiceRepoUploadForm';
import { VoiceRepoRowActions } from '@/components/voice-repo/VoiceRepoRowActions';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Voice Repo — Naadvidya' };

interface RepoRow extends VoiceRepoItem {
  collection_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export default async function TeacherVoiceRepoPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/voice-repo');

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id, slug').eq('profile_id', user.id).maybeSingle<{ id: string; slug: string | null }>();
  if (!teacher) redirect('/dashboard');

  const [{ data: recordings }, { data: collections }] = await Promise.all([
    supabase
      .from('voice_repo')
      .select('id, title, description, raga, taal, category, level_min, level_max, duration_seconds, notes_text, notes_pdf_key, notes_pdf_url, is_public_sample, play_count, collection_id, is_active, sort_order')
      .eq('teacher_id', teacher.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .returns<RepoRow[]>(),
    supabase
      .from('voice_repo_collections')
      .select('id, title')
      .eq('teacher_id', teacher.id)
      .order('sort_order', { ascending: true })
      .returns<{ id: string; title: string }[]>(),
  ]);

  const all = recordings ?? [];
  const cols = collections ?? [];
  const hasPublicSample = all.some((r) => r.is_public_sample);

  // Presign notation PDFs for inline preview
  if (isR2Configured()) {
    await Promise.all(all.map(async (r) => {
      if (r.notes_pdf_key) { try { (r as RepoRow).notes_pdf_url = await presignRead(r.notes_pdf_key); } catch { /* */ } }
    }));
  }

  // Group: by collection, then "Unfiled"
  const byCollection = new Map<string, RepoRow[]>();
  const unfiled: RepoRow[] = [];
  for (const r of all) {
    if (r.collection_id) {
      const arr = byCollection.get(r.collection_id) ?? [];
      arr.push(r);
      byCollection.set(r.collection_id, arr);
    } else unfiled.push(r);
  }

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/teacher/dashboard" className="text-muted-warm hover:text-maroon-mid">Dashboard</Link>
            <form action={logoutAction}><button type="submit" className="text-muted-warm hover:text-maroon-mid">Sign out</button></form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/teacher/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Dashboard</Link>
        <div className="mt-4 mb-2">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Library</p>
          <h1 className="font-display text-4xl text-maroon">Voice Repo</h1>
        </div>
        <p className="text-muted-warm mb-6 max-w-2xl">
          Short reference recordings for your students — phrases, alankaars, bandish renderings,
          corrections. Students who have booked you can stream all of these. One recording can be
          your <em>public sample</em>, shown on your profile to prospective students.
          {teacher.slug && <> Your profile: <Link href={`/teachers/${teacher.slug}`} className="text-maroon-mid hover:underline">/teachers/{teacher.slug}</Link></>}
        </p>

        {!isR2Configured() && (
          <div className="mb-6 rounded-lg border border-gold/40 bg-parchment-2 p-4 text-sm">
            File storage (R2) isn&rsquo;t configured — uploads will fail until <code>R2_*</code> env vars are set.
          </div>
        )}

        <div className="mb-8">
          <VoiceRepoUploadForm collections={cols} hasPublicSample={hasPublicSample} />
        </div>

        {all.length === 0 ? (
          <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-8 text-center text-muted-warm">
            No recordings yet. Add your first — even a 90-second public sample of you teaching does more
            than any bio paragraph.
          </div>
        ) : (
          <div className="space-y-10">
            {cols.map((c) => {
              const items = byCollection.get(c.id) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={c.id}>
                  <h2 className="font-display text-2xl text-maroon mb-3">{c.title}</h2>
                  <div className="space-y-3">
                    {items.map((r) => (
                      <div key={r.id} className={r.is_active ? '' : 'opacity-50'}>
                        <VoiceRepoPlayer item={r} showPlayCount />
                        <VoiceRepoRowActions id={r.id} isPublicSample={r.is_public_sample} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
            {unfiled.length > 0 && (
              <section>
                <h2 className="font-display text-2xl text-maroon mb-3">{cols.length > 0 ? 'Unfiled' : 'All recordings'}</h2>
                <div className="space-y-3">
                  {unfiled.map((r) => (
                    <div key={r.id} className={r.is_active ? '' : 'opacity-50'}>
                      <VoiceRepoPlayer item={r} showPlayCount />
                      <VoiceRepoRowActions id={r.id} isPublicSample={r.is_public_sample} />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
