import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Teacher saves where to be paid. Kept minimal: UPI id, or bank name + account + IFSC.
// Stored in teacher_payout_details (separate, RLS-locked to the teacher + admin).

interface Body {
  payoutMethod: 'upi' | 'bank';
  upiId?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: teacher } = await supabase.from('teacher_profiles').select('id').eq('profile_id', user.id).maybeSingle<{ id: string }>();
  if (!teacher) return NextResponse.json({ error: 'Teachers only' }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.payoutMethod === 'upi') {
    const upi = (body.upiId ?? '').trim();
    if (!UPI.test(upi)) return NextResponse.json({ error: 'Enter a valid UPI ID (e.g. name@bank).' }, { status: 400 });
    const { error } = await supabase.from('teacher_payout_details').upsert({
      teacher_id: teacher.id, payout_method: 'upi', upi_id: upi,
      bank_account_name: null, bank_account_number: null, bank_ifsc: null,
    }, { onConflict: 'teacher_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.payoutMethod === 'bank') {
    const name = (body.bankAccountName ?? '').trim();
    const acct = (body.bankAccountNumber ?? '').trim().replace(/\s+/g, '');
    const ifsc = (body.bankIfsc ?? '').trim().toUpperCase();
    if (name.length < 2) return NextResponse.json({ error: 'Account holder name required.' }, { status: 400 });
    if (!/^\d{6,18}$/.test(acct)) return NextResponse.json({ error: 'Bank account number looks invalid (6–18 digits).' }, { status: 400 });
    if (!IFSC.test(ifsc)) return NextResponse.json({ error: 'IFSC code looks invalid (e.g. HDFC0001234).' }, { status: 400 });
    const { error } = await supabase.from('teacher_payout_details').upsert({
      teacher_id: teacher.id, payout_method: 'bank',
      bank_account_name: name, bank_account_number: acct, bank_ifsc: ifsc, upi_id: null,
    }, { onConflict: 'teacher_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'payoutMethod must be "upi" or "bank"' }, { status: 400 });
}
