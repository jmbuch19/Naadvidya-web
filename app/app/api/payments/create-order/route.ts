import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOrder } from '@/lib/razorpay';

interface PackRow {
  id: string;
  name: string;
  price_inr: number;
  is_active: boolean;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let body: { packageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.packageId) {
    return NextResponse.json({ error: 'packageId required' }, { status: 400 });
  }

  const { data: pack, error } = await supabase
    .from('session_packages')
    .select('id, name, price_inr, is_active')
    .eq('id', body.packageId)
    .eq('is_active', true)
    .maybeSingle<PackRow>();

  if (error || !pack) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  try {
    const order = await createOrder({
      amountInr: pack.price_inr,
      packageId: pack.id,
      studentId: user.id,
    });
    return NextResponse.json(order);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Order creation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
