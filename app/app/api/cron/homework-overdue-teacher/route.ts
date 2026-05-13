import { NextResponse } from 'next/server';
import { assertCron } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// Nudge teachers who have student submissions awaiting review for more than 72h
// (TEACHER_TERMS §C.2). Runs daily ~6:00 IST. One digest email per teacher.

interface Row {
  id: string;
  student: { full_name: string };
  assignment: { title: string; teacher: { id: string; profile: { full_name: string; email: string } } };
}

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await admin
    .from('submissions')
    .select(`id,
      student:profiles!submissions_student_id_fkey(full_name),
      assignment:assignments!submissions_assignment_id_fkey(title, teacher:teacher_profiles!assignments_teacher_id_fkey(id, profile:profiles!teacher_profiles_profile_id_fkey(full_name, email)))`)
    .eq('status', 'submitted')
    .lt('submitted_at', cutoff)
    .limit(500)
    .returns<Row[]>();

  // Group by teacher
  const byTeacher = new Map<string, { name: string; email: string; items: string[] }>();
  for (const s of rows ?? []) {
    const t = s.assignment?.teacher;
    if (!t?.profile?.email) continue;
    const ex = byTeacher.get(t.id) ?? { name: t.profile.full_name, email: t.profile.email, items: [] };
    ex.items.push(`${s.student?.full_name ?? 'A student'} — "${s.assignment.title}"`);
    byTeacher.set(t.id, ex);
  }

  let emailed = 0;
  for (const t of Array.from(byTeacher.values())) {
    await sendEmail({
      to: t.email,
      subject: `${t.items.length} homework submission${t.items.length === 1 ? '' : 's'} awaiting your review`,
      html: `<p>Namaste ${t.name},</p><p>You have ${t.items.length} student submission${t.items.length === 1 ? '' : 's'} that ${t.items.length === 1 ? 'has' : 'have'} been waiting more than 72 hours for your feedback:</p><ul>${t.items.map((i: string) => `<li>${i}</li>`).join('')}</ul><p>Please review them — feedback before the next session is the heart of how Naadvidya works.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.com'}/teacher/homework">Open your homework inbox</a></p><p>— Naadvidya</p>`,
    });
    emailed++;
  }
  return NextResponse.json({ ok: true, teachersEmailed: emailed });
}
