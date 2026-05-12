import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

interface Body {
  paymentReference: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.paymentReference || !body.paymentReference.trim()) {
    return NextResponse.json({ error: 'paymentReference required (UPI ID / bank ref)' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: payout } = await admin
    .from('payouts')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle<{ id: string; status: string }>();

  if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
  if (payout.status !== 'pending') {
    return NextResponse.json({ error: `Payout is ${payout.status}, cannot mark paid` }, { status: 400 });
  }

  const { error } = await admin
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference: body.paymentReference.trim(),
    })
    .eq('id', payout.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: payout.id, status: 'paid' });
}
