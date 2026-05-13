// Shared logic for the session-reminder crons (24hr / 1hr / start). Finds upcoming
// Mehfil bookings + scheduled sessions in a time window that haven't had this reminder
// yet, emails both parties, and sets the dedup flag.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { notifyUpcomingSession } from '@/lib/notifications';

type Kind = '24hr' | '1hr' | 'start';
const FLAG: Record<Kind, 'reminded_24hr' | 'reminded_1hr' | 'reminded_start'> = {
  '24hr': 'reminded_24hr', '1hr': 'reminded_1hr', start: 'reminded_start',
};

interface Person { full_name: string; email: string; whatsapp_number: string | null; whatsapp_opted_in: boolean }

interface BookingRow {
  id: string; scheduled_at: string;
  student: Person; teacher: { profile: Person };
}
interface ScheduledRow {
  id: string; scheduled_at: string;
  student: Person; teacher: { profile: Person };
}

export async function runSessionReminders(kind: Kind, startISO: string, endISO: string) {
  const admin = createServiceRoleClient();
  const flag = FLAG[kind];
  let notified = 0;

  // --- Mehfil bookings ---
  const { data: bookings } = await admin
    .from('bookings')
    .select(`id, scheduled_at,
      student:profiles!bookings_student_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in),
      teacher:teacher_profiles!bookings_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in))`)
    .eq('status', 'confirmed')
    .eq(flag, false)
    .gte('scheduled_at', startISO)
    .lte('scheduled_at', endISO)
    .limit(200)
    .returns<BookingRow[]>();

  for (const b of bookings ?? []) {
    const when = new Date(b.scheduled_at);
    await Promise.allSettled([
      notifyUpcomingSession({ recipient: rec(b.student), isTeacher: false, withWhom: b.teacher.profile.full_name, scheduledAt: when, kind, joinHref: `/session/${b.id}` }),
      notifyUpcomingSession({ recipient: rec(b.teacher.profile), isTeacher: true, withWhom: b.student.full_name, scheduledAt: when, kind, joinHref: `/session/${b.id}` }),
    ]);
    await admin.from('bookings').update({ [flag]: true }).eq('id', b.id);
    notified++;
  }

  // --- Scheduled (Workshop / Gurukul) sessions ---
  const { data: sched } = await admin
    .from('scheduled_sessions')
    .select(`id, scheduled_at,
      student:profiles!scheduled_sessions_student_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in),
      teacher:teacher_profiles!scheduled_sessions_teacher_id_fkey(profile:profiles!teacher_profiles_profile_id_fkey(full_name, email, whatsapp_number, whatsapp_opted_in))`)
    .eq('status', 'upcoming')
    .eq(flag, false)
    .gte('scheduled_at', startISO)
    .lte('scheduled_at', endISO)
    .limit(200)
    .returns<ScheduledRow[]>();

  for (const s of sched ?? []) {
    const when = new Date(s.scheduled_at);
    await Promise.allSettled([
      notifyUpcomingSession({ recipient: rec(s.student), isTeacher: false, withWhom: s.teacher.profile.full_name, scheduledAt: when, kind, joinHref: `/session/s/${s.id}` }),
      notifyUpcomingSession({ recipient: rec(s.teacher.profile), isTeacher: true, withWhom: s.student.full_name, scheduledAt: when, kind, joinHref: `/session/s/${s.id}` }),
    ]);
    await admin.from('scheduled_sessions').update({ [flag]: true }).eq('id', s.id);
    notified++;
  }

  return notified;
}

function rec(p: Person) {
  return { email: p.email, fullName: p.full_name, whatsappNumber: p.whatsapp_number, whatsappOptedIn: p.whatsapp_opted_in };
}
