import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

// Teacher accepts a pending Gurukul application → enrollment status 'active'.
// (Sessions get scheduled separately via /api/sessions/bulk-create.)

interface Row { id: string; status: string; teacher: { profile_id: string }; offering: { offering_type: string } }

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: enr } = await supabase
    .from('enrollments')
    .select('id, status, teacher:teacher_profiles!enrollments_teacher_id_fkey(profile_id), offering:class_offerings!enrollments_offering_id_fkey(offering_type)')
    .eq('id', params.id)
    .maybeSingle<Row>();
  if (!enr) return NextResponse.json({ error: 'Enrolment not found' }, { status: 404 });
  if (enr.teacher.profile_id !== user.id) return NextResponse.json({ error: 'Not your enrolment' }, { status: 403 });
  if (enr.status !== 'pending') return NextResponse.json({ error: `Enrolment is ${enr.status}, cannot accept` }, { status: 400 });

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('enrollments')
    .update({ status: 'active', start_date: new Date().toISOString().slice(0, 10) })
    .eq('id', enr.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'active' });
}
