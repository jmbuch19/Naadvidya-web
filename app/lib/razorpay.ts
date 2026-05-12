// Razorpay server-side helpers.
// Webhook signature verification is the security-critical piece — never credit
// a student's wallet without crypto.createHmac verification.

import Razorpay from 'razorpay';
import crypto from 'node:crypto';

let cached: Razorpay | null = null;

export function getRazorpay(): Razorpay | null {
  if (cached) return cached;
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  cached = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  return cached;
}

export interface CreateOrderInput {
  amountInr: number;
  packageId: string;
  studentId: string;
}

export interface CreatedOrder {
  orderId: string;
  amount: number;
  currency: 'INR';
  keyId: string;
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const client = getRazorpay();
  if (!client) {
    throw new Error('Razorpay not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  }

  const order = await client.orders.create({
    amount: Math.round(input.amountInr * 100), // paise
    currency: 'INR',
    receipt: `naadvidya_${Date.now()}`,
    notes: {
      package_id: input.packageId,
      student_id: input.studentId,
    },
  });

  return {
    orderId: order.id,
    amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID!,
  };
}

// Verify Razorpay webhook signature — HMAC SHA256 of raw body with webhook secret.
// MUST be called BEFORE touching the database. Return false → reject the request 401.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[razorpay] RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Verify a successful payment from the client-side checkout (the alternative path
// when we want to credit the wallet immediately rather than waiting for the webhook).
// Razorpay returns razorpay_payment_id, razorpay_order_id, razorpay_signature.
// The signature is HMAC(order_id + '|' + payment_id, key_secret).
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
  } catch {
    return false;
  }
}
