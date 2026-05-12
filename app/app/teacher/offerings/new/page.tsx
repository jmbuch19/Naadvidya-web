import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { OfferingForm } from '@/components/offerings/OfferingForm';
import { logoutAction } from '../../../(auth)/actions';

export const metadata = { title: 'New offering — Naadvidya' };

export default async function NewOfferingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/teacher/offerings/new');

  const { data: teacher } = await supabase
    .from('teacher_profiles').select('id, approval_status').eq('profile_id', user.id).maybeSingle<{ id: string; approval_status: string }>();
  if (!teacher) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/teacher/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}><button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button></form>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/offerings" className="text-sm text-muted-warm hover:text-maroon-mid">← My offerings</Link>
        <div className="mt-4 mb-6">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">New offering</p>
          <h1 className="font-display text-3xl text-maroon">Create a Workshop or Programme</h1>
        </div>

        {teacher.approval_status !== 'approved' ? (
          <div className="bg-parchment-2 border border-line rounded-lg p-6 text-muted-warm">
            Your teacher profile must be approved before you can create offerings. Once Amee approves your
            profile, come back here.
          </div>
        ) : (
          <OfferingForm />
        )}
      </main>
    </div>
  );
}
