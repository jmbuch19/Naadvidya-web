import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Admin approves a class offering: approval_status='approved', is_visible=true (atomic).

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const admin = createServiceRoleClient();
  const { data: offering } = await admin
    .from('class_offerings').select('id, approval_status').eq('id', params.id).maybeSingle<{ id: string; approval_status: string }>();
  if (!offering) return NextResponse.json({ error: 'Offering not found' }, { status: 404 });

  const { error } = await admin
    .from('class_offerings')
    .update({ approval_status: 'approved', is_visible: true, rejection_note: null, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', offering.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
