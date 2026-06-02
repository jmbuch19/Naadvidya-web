// Unified notification dispatcher for Naadvidya.
//
// One function per platform event. Each fires email (always when configured) AND
// WhatsApp (only if recipient has whatsapp_opted_in + a number). Both layers
// gracefully no-op when their respective service env vars are missing.
//
// Called from API routes after the transactional DB write completes. Failures
// are logged but never thrown — notifications should never break a request.

import { sendEmail, emailCreditsCredited } from './resend';
import {
  waBookingConfirmed,
  waAssignmentPosted,
  waFeedbackReceived,
  waTeacherApproved,
  waNewBookingRequest,
  waHomeworkSubmitted,
  waBookingCancelledByTeacher,
} from './whatsapp';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.in';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function emailLayout(opts: { greeting: string; body: string; cta?: { label: string; href: string } }): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1A0A00;padding:20px;">
      <div style="font-family:Georgia,serif;color:#8B1A1A;font-size:24px;margin-bottom:16px;">${opts.greeting}</div>
      <div style="line-height:1.6;">${opts.body}</div>
      ${opts.cta ? `<div style="margin-top:24px;"><a href="${opts.cta.href}" style="display:inline-block;background:#8B1A1A;color:#FAF3E0;padding:10px 20px;border-radius:6px;text-decoration:none;">${opts.cta.label}</a></div>` : ''}
      <div style="color:#7A6652;font-size:13px;margin-top:32px;border-top:1px solid #E0D4B8;padding-top:16px;">— Naadvidya · नादविद्या</div>
    </div>
  `;
}

interface Recipient {
  email: string;
  fullName: string;
  whatsappNumber?: string | null;
  whatsappOptedIn?: boolean;
}

export function fmtWhen(d: Date): string {
  return d.toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) + ' IST';
}

// --- Session reminders (used by the cron jobs) ---

export async function notifyUpcomingSession(opts: {
  recipient: Recipient;
  isTeacher: boolean;
  withWhom: string;          // the other party's name
  scheduledAt: Date;
  kind: '24hr' | '1hr' | 'start';
  joinHref: string;          // dashboard or session page
}) {
  const when = fmtWhen(opts.scheduledAt);
  const heading = opts.kind === '24hr' ? 'Session tomorrow' : opts.kind === '1hr' ? 'Session in about an hour' : 'Your session is starting';
  const lead =
    opts.kind === '24hr' ? `a reminder that you have a session ${opts.isTeacher ? `with ${opts.withWhom}` : `with ${opts.withWhom}`} coming up`
    : opts.kind === '1hr' ? `your session ${opts.isTeacher ? `with ${opts.withWhom}` : `with ${opts.withWhom}`} begins in about an hour`
    : `your session ${opts.isTeacher ? `with ${opts.withWhom}` : `with ${opts.withWhom}`} is starting now`;
  await sendEmail({
    to: opts.recipient.email,
    subject: opts.kind === 'start' ? `Starting now — your session with ${opts.withWhom} 🎵` : `${heading} — with ${opts.withWhom}`,
    html: emailLayout({
      greeting: `Namaste, ${escapeHtml(opts.recipient.fullName)}.`,
      body: `<p>This is ${lead}.</p><p><strong>${escapeHtml(when)}</strong></p><p>The room ${opts.kind === 'start' ? 'is open' : 'opens 15 minutes before'} — join from your dashboard.</p>`,
      cta: { label: opts.kind === 'start' ? 'Join now' : 'Open dashboard', href: `${APP_URL}${opts.joinHref}` },
    }),
    text: `${heading}: with ${opts.withWhom}, ${when}. ${APP_URL}${opts.joinHref}`,
  });
}

// --- Booking lifecycle ---

export async function notifyNewBookingRequest(opts: {
  teacher: Recipient;
  studentName: string;
  scheduledAt: Date;
  isTrial: boolean;
}) {
  const dateStr = opts.scheduledAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  const timeStr = opts.scheduledAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  await Promise.allSettled([
    sendEmail({
      to: opts.teacher.email,
      subject: `New session request from ${opts.studentName}${opts.isTrial ? ' (free trial)' : ''}`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.teacher.fullName)}.`,
        body: `
          <p><strong>${escapeHtml(opts.studentName)}</strong> has requested ${opts.isTrial ? 'a free 15-minute trial session' : 'a session'} with you.</p>
          <p><strong>${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</strong></p>
          <p>Confirm or decline from your dashboard within 24 hours.</p>
        `,
        cta: { label: 'Open dashboard', href: `${APP_URL}/teacher/dashboard` },
      }),
      text: `New session request from ${opts.studentName} on ${dateStr} at ${timeStr}. Confirm at ${APP_URL}/teacher/dashboard`,
    }),
    waNewBookingRequest({
      to: opts.teacher.whatsappNumber ?? '',
      optedIn: opts.teacher.whatsappOptedIn ?? false,
      teacherName: opts.teacher.fullName,
      studentName: opts.studentName,
      requestedDate: dateStr,
      requestedTime: timeStr,
    }),
  ]);
}

export async function notifyBookingConfirmed(opts: {
  student: Recipient;
  teacherName: string;
  scheduledAt: Date;
}) {
  const dateStr = opts.scheduledAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = opts.scheduledAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  await Promise.allSettled([
    sendEmail({
      to: opts.student.email,
      subject: `Session confirmed with ${opts.teacherName} 🎵`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.student.fullName)}.`,
        body: `
          <p>Your session with <strong>${escapeHtml(opts.teacherName)}</strong> is confirmed.</p>
          <p><strong>${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</strong></p>
          <p>Your join link appears in your dashboard 15 minutes before the session starts. Come prepared. Shruti ready.</p>
        `,
        cta: { label: 'Open dashboard', href: `${APP_URL}/dashboard` },
      }),
      text: `Session confirmed with ${opts.teacherName} on ${dateStr} at ${timeStr}. Join: ${APP_URL}/dashboard`,
    }),
    waBookingConfirmed({
      to: opts.student.whatsappNumber ?? '',
      optedIn: opts.student.whatsappOptedIn ?? false,
      studentName: opts.student.fullName,
      teacherName: opts.teacherName,
      date: dateStr,
      time: timeStr,
      timezone: 'IST',
    }),
  ]);
}

export async function notifyBookingCancelledByTeacher(opts: {
  student: Recipient;
  teacherName: string;
  scheduledAt: Date;
}) {
  const dateStr = opts.scheduledAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  await Promise.allSettled([
    sendEmail({
      to: opts.student.email,
      subject: `Session cancelled — credit refunded`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.student.fullName)}.`,
        body: `
          <p>Your session with <strong>${escapeHtml(opts.teacherName)}</strong> on ${escapeHtml(dateStr)} has been cancelled by the teacher.</p>
          <p>Your credit has been refunded to your wallet. You can rebook anytime.</p>
        `,
        cta: { label: 'Find another guru', href: `${APP_URL}/teachers` },
      }),
    }),
    waBookingCancelledByTeacher({
      to: opts.student.whatsappNumber ?? '',
      optedIn: opts.student.whatsappOptedIn ?? false,
      studentName: opts.student.fullName,
      teacherName: opts.teacherName,
      date: dateStr,
    }),
  ]);
}

// --- Homework loop ---

export async function notifyAssignmentPosted(opts: {
  student: Recipient;
  teacherName: string;
  assignmentTitle: string;
  dueBefore: Date | null;
}) {
  const dueStr = opts.dueBefore
    ? opts.dueBefore.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
    : 'before your next session';

  await Promise.allSettled([
    sendEmail({
      to: opts.student.email,
      subject: `New homework from ${opts.teacherName}: ${opts.assignmentTitle}`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.student.fullName)}.`,
        body: `
          <p><strong>${escapeHtml(opts.teacherName)}</strong> has posted homework for you.</p>
          <p><strong>${escapeHtml(opts.assignmentTitle)}</strong></p>
          <p>Submit ${escapeHtml(dueStr)}.</p>
        `,
        cta: { label: 'Open homework', href: `${APP_URL}/homework` },
      }),
    }),
    waAssignmentPosted({
      to: opts.student.whatsappNumber ?? '',
      optedIn: opts.student.whatsappOptedIn ?? false,
      studentName: opts.student.fullName,
      teacherName: opts.teacherName,
      assignmentTitle: opts.assignmentTitle,
      dueDate: dueStr,
    }),
  ]);
}

export async function notifyHomeworkSubmitted(opts: {
  teacher: Recipient;
  studentName: string;
  assignmentTitle: string;
  fileCount: number;
}) {
  await Promise.allSettled([
    sendEmail({
      to: opts.teacher.email,
      subject: `${opts.studentName} submitted homework: ${opts.assignmentTitle}`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.teacher.fullName)}.`,
        body: `
          <p><strong>${escapeHtml(opts.studentName)}</strong> has submitted homework for <strong>${escapeHtml(opts.assignmentTitle)}</strong>.</p>
          <p>${opts.fileCount} file${opts.fileCount === 1 ? '' : 's'} attached. Please review within 72 hours.</p>
        `,
        cta: { label: 'Review homework', href: `${APP_URL}/teacher/homework` },
      }),
    }),
    waHomeworkSubmitted({
      to: opts.teacher.whatsappNumber ?? '',
      optedIn: opts.teacher.whatsappOptedIn ?? false,
      teacherName: opts.teacher.fullName,
      studentName: opts.studentName,
      assignmentTitle: opts.assignmentTitle,
      fileCount: opts.fileCount,
      nextSessionDate: 'next session',
    }),
  ]);
}

export async function notifyFeedbackReceived(opts: {
  student: Recipient;
  teacherName: string;
  assignmentTitle: string;
}) {
  await Promise.allSettled([
    sendEmail({
      to: opts.student.email,
      subject: `Feedback from ${opts.teacherName} on ${opts.assignmentTitle}`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.student.fullName)}.`,
        body: `
          <p><strong>${escapeHtml(opts.teacherName)}</strong> has reviewed your homework and posted feedback.</p>
          <p><strong>${escapeHtml(opts.assignmentTitle)}</strong></p>
          <p>Read it carefully — every word from a guru is worth absorbing.</p>
        `,
        cta: { label: 'Read feedback', href: `${APP_URL}/homework` },
      }),
    }),
    waFeedbackReceived({
      to: opts.student.whatsappNumber ?? '',
      optedIn: opts.student.whatsappOptedIn ?? false,
      studentName: opts.student.fullName,
      teacherName: opts.teacherName,
      assignmentTitle: opts.assignmentTitle,
    }),
  ]);
}

// --- Teacher lifecycle ---

export async function notifyTeacherApproved(opts: { teacher: Recipient }) {
  await Promise.allSettled([
    sendEmail({
      to: opts.teacher.email,
      subject: `You're approved on Naadvidya 🙏`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.teacher.fullName)}.`,
        body: `
          <p>Welcome to Naadvidya. Your teacher profile has been approved by the Naadvidya Gurus and is now live on the platform.</p>
          <p>Next steps:</p>
          <ol>
            <li>Polish your bio and availability slots — at least 4 per week to stay active.</li>
            <li>Watch your dashboard for incoming booking requests.</li>
            <li>Confirm or decline within 24 hours of receipt.</li>
          </ol>
        `,
        cta: { label: 'Open teacher dashboard', href: `${APP_URL}/teacher/dashboard` },
      }),
    }),
    waTeacherApproved({
      to: opts.teacher.whatsappNumber ?? '',
      optedIn: opts.teacher.whatsappOptedIn ?? false,
      teacherName: opts.teacher.fullName,
    }),
  ]);
}

export async function notifyTeacherRejected(opts: { teacher: Recipient; reason: string }) {
  await Promise.allSettled([
    sendEmail({
      to: opts.teacher.email,
      subject: `Update on your Naadvidya application`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.teacher.fullName)}.`,
        body: `
          <p>Thank you for applying to teach at Naadvidya.</p>
          <p>After review, we&rsquo;re unable to approve your application at this time:</p>
          <blockquote style="border-left:3px solid #C5A028;padding-left:12px;color:#7A6652;">${escapeHtml(opts.reason)}</blockquote>
          <p>You may reapply after 90 days. We wish you well in your sadhana.</p>
        `,
      }),
    }),
    // No WA template — sensitive, email only
  ]);
}

// --- Reschedule flow (SCHEDULING_HOLIDAY_POLICY §2) ---
// Email only — no WhatsApp templates approved yet for reschedule events.

export async function notifyReschedulProposed(opts: {
  recipient: Recipient;
  proposerName: string;
  oldScheduledAt: Date;
  proposedNewAt: Date;
  reason: string;
  dashboardHref: string;
}) {
  const oldWhen = fmtWhen(opts.oldScheduledAt);
  const newWhen = fmtWhen(opts.proposedNewAt);
  await sendEmail({
    to: opts.recipient.email,
    subject: `Reschedule proposal from ${opts.proposerName}`,
    html: emailLayout({
      greeting: `Namaste, ${escapeHtml(opts.recipient.fullName)}.`,
      body: `
        <p><strong>${escapeHtml(opts.proposerName)}</strong> has proposed to reschedule your session.</p>
        <p style="margin:8px 0;color:#7A6652;">From: ${escapeHtml(oldWhen)}<br>To: <strong>${escapeHtml(newWhen)}</strong></p>
        <p style="margin:8px 0;"><em>${escapeHtml(opts.reason)}</em></p>
        <p>Please accept or decline within 24 hours. If you don't respond, the original time stands.</p>
      `,
      cta: { label: 'Review proposal', href: opts.dashboardHref },
    }),
  });
}

export async function notifyRescheduleAccepted(opts: {
  recipient: Recipient;
  responderName: string;
  newScheduledAt: Date;
  dashboardHref: string;
}) {
  const newWhen = fmtWhen(opts.newScheduledAt);
  await sendEmail({
    to: opts.recipient.email,
    subject: `Reschedule accepted — new time confirmed`,
    html: emailLayout({
      greeting: `Namaste, ${escapeHtml(opts.recipient.fullName)}.`,
      body: `
        <p><strong>${escapeHtml(opts.responderName)}</strong> accepted your reschedule request.</p>
        <p>New session time: <strong>${escapeHtml(newWhen)}</strong></p>
        <p>The video room will be ready 15 minutes before start.</p>
      `,
      cta: { label: 'Open dashboard', href: opts.dashboardHref },
    }),
  });
}

export async function notifyRescheduleDeclined(opts: {
  recipient: Recipient;
  responderName: string;
  originalScheduledAt: Date;
  dashboardHref: string;
}) {
  const when = fmtWhen(opts.originalScheduledAt);
  await sendEmail({
    to: opts.recipient.email,
    subject: `Reschedule declined — original time stands`,
    html: emailLayout({
      greeting: `Namaste, ${escapeHtml(opts.recipient.fullName)}.`,
      body: `
        <p><strong>${escapeHtml(opts.responderName)}</strong> declined the reschedule. Your original session at <strong>${escapeHtml(when)}</strong> still stands.</p>
      `,
      cta: { label: 'Open dashboard', href: opts.dashboardHref },
    }),
  });
}

// --- Holiday-affected sessions (SCHEDULING_HOLIDAY_POLICY §4.3) ---

export async function notifyHolidayCancellation(opts: {
  student: Recipient;
  teacherName: string;
  scheduledAt: Date;
  holidayDate: string; // YYYY-MM-DD
}) {
  const when = fmtWhen(opts.scheduledAt);
  await Promise.allSettled([
    sendEmail({
      to: opts.student.email,
      subject: `Session cancelled — ${opts.teacherName} marked a holiday`,
      html: emailLayout({
        greeting: `Namaste, ${escapeHtml(opts.student.fullName)}.`,
        body: `
          <p>Your session with <strong>${escapeHtml(opts.teacherName)}</strong> on <strong>${escapeHtml(when)}</strong> has been cancelled — the teacher marked ${escapeHtml(opts.holidayDate)} as a holiday.</p>
          <p>Your credit has been refunded. You can rebook a different slot anytime.</p>
        `,
        cta: { label: 'Rebook', href: `${APP_URL}/teachers` },
      }),
    }),
    waBookingCancelledByTeacher({
      to: opts.student.whatsappNumber ?? '',
      optedIn: opts.student.whatsappOptedIn ?? false,
      studentName: opts.student.fullName,
      teacherName: opts.teacherName,
      date: opts.scheduledAt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }),
    }),
  ]);
}

// --- Credits (already partially wired in webhook/verify; keep as wrapper) ---

export { emailCreditsCredited };
