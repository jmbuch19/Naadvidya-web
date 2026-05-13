import { NextResponse } from 'next/server';
import { assertCron, futureWindow } from '@/lib/cron';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/resend';

export const dynamic = 'force-dynamic';

// Remind students of homework due in the next ~36h that they haven't submitted yet.
// Runs daily ~8:00 IST. Dedup via assignments.due_reminded.

interface Row {
  id: string; title: string; due_before: string;
  student: { full_name: string; email: string };
  teacher: { profile: { full_name: string } };
  submissions: { status: string }[];
}

export async function GET(req: Request) {
  const bad = assertCron(req); if (bad) return bad;
  const admin = createServiceRoleClient();
  const { startISO, endISO } = futureWindow(0, 36 * 60);

  const { data: rows } = await admin
    .from('assignments')
    .select(`id, title, due_before,
      student:profiles!assignments_student_id_fkey(full_name, email),
      teacher:teacher_profiles!assignments_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name)),
      submissions(status)`)
    .eq('due_reminded', false)
    .gte('due_before', startISO)
    .lte('due_before', endISO)
    .limit(200)
    .returns<Row[]>();

  let reminded = 0;
  for (const a of rows ?? []) {
    const done = (a.submissions ?? []).some((s) => s.status === 'submitted' || s.status === 'reviewed');
    if (!done && a.student?.email) {
      const dueStr = new Date(a.due_before).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
      await sendEmail({
        to: a.student.email,
        subject: `Homework due soon: ${a.title}`,
        html: `<p>Namaste ${a.student.full_name},</p><p>Your homework <strong>${a.title}</strong> from ${a.teacher?.profile?.full_name ?? 'your guru'} is due <strong>${dueStr} IST</strong>. Upload your recordings and notes before then.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.com'}/homework">Open your homework</a></p><p>— Naadvidya</p>`,
      });
    }
    await admin.from('assignments').update({ due_reminded: true }).eq('id', a.id);
    reminded++;
  }
  return NextResponse.json({ ok: true, processed: reminded });
}
