// Resend email helpers. Graceful no-op when RESEND_API_KEY not set (dev/local).

import { Resend } from 'resend';

let cached: Resend | null = null;

function getResend(): Resend | null {
  if (cached) return cached;
  if (!process.env.RESEND_API_KEY) return null;
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

const FROM = `${process.env.RESEND_FROM_NAME ?? 'Naadvidya'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@naadvidya.in'}>`;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string } | null> {
  const client = getResend();
  if (!client) {
    console.warn(`[resend] not configured — would send to ${input.to}: ${input.subject}`);
    return null;
  }
  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error('[resend] send failed:', error);
      return null;
    }
    return data?.id ? { id: data.id } : null;
  } catch (e) {
    console.error('[resend] exception:', e);
    return null;
  }
}

// --- Naadvidya transactional emails ---

export async function emailCreditsCredited(input: {
  to: string;
  studentName: string;
  packName: string;
  credits: number;
  totalBalance: number;
}) {
  return sendEmail({
    to: input.to,
    subject: `Your ${input.packName} pack is ready 🎵`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1A0A00;">
        <h1 style="font-family:Georgia,serif;color:#8B1A1A;">Namaste, ${escapeHtml(input.studentName)}.</h1>
        <p>Your <strong>${escapeHtml(input.packName)}</strong> pack has been credited to your Naadvidya wallet.</p>
        <p style="font-size:18px;"><strong>${input.credits}</strong> sessions added · Balance: <strong>${input.totalBalance}</strong> sessions</p>
        <p>Browse your guru — and begin your sadhana.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://naadvidya.in'}/teachers" style="display:inline-block;background:#8B1A1A;color:#FAF3E0;padding:10px 20px;border-radius:6px;text-decoration:none;">Find your guru</a></p>
        <p style="color:#7A6652;font-size:13px;margin-top:32px;">— Naadvidya · नादविद्या</p>
      </div>
    `,
    text: `Namaste ${input.studentName}. Your ${input.packName} pack is ready. ${input.credits} sessions added. Balance: ${input.totalBalance} sessions. Find your guru: ${process.env.NEXT_PUBLIC_APP_URL}/teachers`,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
