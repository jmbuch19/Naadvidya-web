import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { emailCreditsCredited } from '@/lib/resend';

// Razorpay webhook. CRITICAL: verify HMAC SHA256 of the raw body before
// touching the database. The webhook URL is set in dashboard.razorpay.com →
// Settings → Webhooks. Subscribe to: payment.captured (primary), order.paid.
//
// Idempotency: every credit insert is keyed by razorpay_payment_id in
// credit_transactions. The unique index on that column blocks double-credits.

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  notes?: { package_id?: string; student_id?: string };
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayPaymentEntity };
  };
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[razorpay webhook] signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.event !== 'payment.captured') {
    // Acknowledge other events but no-op
    return NextResponse.json({ received: true });
  }

  const payment = payload.payload.payment?.entity;
  if (!payment || payment.status !== 'captured') {
    return NextResponse.json({ received: true });
  }

  const packageId = payment.notes?.package_id;
  const studentId = payment.notes?.student_id;
  if (!packageId || !studentId) {
    console.error('[razorpay webhook] payment missing notes', payment.id);
    return NextResponse.json({ error: 'Missing notes' }, { status: 400 });
  }

  // Service-role client to bypass RLS for the ledger insert + student notification.
  const supabase = createServiceRoleClient();

  // Idempotency: if a transaction already exists for this payment, no-op.
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('razorpay_payment_id', payment.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Look up the pack to know how many credits to grant.
  const { data: pack, error: packErr } = await supabase
    .from('session_packages')
    .select('id, name, credits, price_inr')
    .eq('id', packageId)
    .maybeSingle<{ id: string; name: string; credits: number; price_inr: number }>();

  if (packErr || !pack) {
    console.error('[razorpay webhook] pack not found', packageId);
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  // Sanity: amount in webhook should match pack price (in paise).
  const expectedPaise = Math.round(pack.price_inr * 100);
  if (payment.amount !== expectedPaise) {
    console.error(`[razorpay webhook] amount mismatch: got ${payment.amount}, expected ${expectedPaise} for pack ${pack.id}`);
    // Don't credit — flag for manual review
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  // Atomic ledger entry + balance update via DB function.
  const { error: rpcErr } = await supabase.rpc('apply_credit_change', {
    p_student_id: studentId,
    p_type: 'purchase',
    p_credits: pack.credits,
    p_package_id: pack.id,
    p_razorpay_order_id: payment.order_id,
    p_razorpay_payment_id: payment.id,
    p_note: `Purchased ${pack.name}`,
  });

  if (rpcErr) {
    console.error('[razorpay webhook] apply_credit_change failed:', rpcErr);
    return NextResponse.json({ error: 'Credit insert failed' }, { status: 500 });
  }

  // Best-effort: send confirmation email (and eventually WhatsApp).
  const { data: student } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', studentId)
    .maybeSingle<{ full_name: string; email: string }>();

  const { data: balanceRow } = await supabase
    .from('student_credits')
    .select('credits_balance')
    .eq('student_id', studentId)
    .maybeSingle<{ credits_balance: number }>();

  if (student?.email) {
    await emailCreditsCredited({
      to: student.email,
      studentName: student.full_name,
      packName: pack.name,
      credits: pack.credits,
      totalBalance: balanceRow?.credits_balance ?? pack.credits,
    });
  }

  return NextResponse.json({ received: true, credited: pack.credits });
}
