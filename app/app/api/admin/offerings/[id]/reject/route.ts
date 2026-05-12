import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

interface Body { reason: string }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.reason || body.reason.trim().length < 5) {
    return NextResponse.json({ error: 'Rejection note (≥5 chars) required' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('class_offerings')
    .update({ approval_status: 'rejected', is_visible: false, rejection_note: body.reason.trim(), approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
