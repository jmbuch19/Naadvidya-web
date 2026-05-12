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
          <p>Welcome to Naadvidya. Your teacher profile has been approved by Amee and is now live on the platform.</p>
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

// --- Credits (already partially wired in webhook/verify; keep as wrapper) ---

export { emailCreditsCredited };
