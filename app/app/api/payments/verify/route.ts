import { NextResponse } from 'next/server';
import { verifyPaymentSignature } from '@/lib/razorpay';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { emailCreditsCredited } from '@/lib/resend';

// Client-side handler calls this after Razorpay closes the modal.
// Functionally redundant with the webhook (and the webhook is authoritative —
// it runs even if the user closes the browser) but credits the wallet immediately
// for a snappier UX. Idempotent: the unique index on razorpay_payment_id blocks dupes.

interface Body {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  packageId: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ok = verifyPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Confirm the user is signed in (don't trust the packageId — re-fetch the pack).
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Use service-role for the credit insert (RLS would block).
  const admin = createServiceRoleClient();

  const { data: existing } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('razorpay_payment_id', body.razorpay_payment_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  const { data: pack, error: packErr } = await admin
    .from('session_packages')
    .select('id, name, credits, price_inr')
    .eq('id', body.packageId)
    .maybeSingle<{ id: string; name: string; credits: number; price_inr: number }>();

  if (packErr || !pack) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  const { error: rpcErr } = await admin.rpc('apply_credit_change', {
    p_student_id: user.id,
    p_type: 'purchase',
    p_credits: pack.credits,
    p_package_id: pack.id,
    p_razorpay_order_id: body.razorpay_order_id,
    p_razorpay_payment_id: body.razorpay_payment_id,
    p_note: `Purchased ${pack.name}`,
  });

  if (rpcErr) {
    console.error('[verify] apply_credit_change failed:', rpcErr);
    return NextResponse.json({ error: 'Credit insert failed' }, { status: 500 });
  }

  const { data: student } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle<{ full_name: string; email: string }>();

  const { data: balanceRow } = await admin
    .from('student_credits')
    .select('credits_balance')
    .eq('student_id', user.id)
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

  return NextResponse.json({ ok: true });
}
