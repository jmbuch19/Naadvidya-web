import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FileType } from '@/lib/supabase/types';

// After the browser uploads to R2 via the presigned URL, it calls this endpoint
// with the key + metadata. We insert the submission_files row (RLS-guarded).
//
// Why two-step? The browser uploads directly to R2 (no server data transit),
// which is cheap and fast. The server only sees the metadata.

interface Body {
  submissionId?: string;
  key?: string;
  fileName?: string;
  fileType?: FileType;
  fileSizeKb?: number;
  label?: string;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.submissionId || !body.key || !body.fileName || !body.fileType) {
    return NextResponse.json({ error: 'submissionId, key, fileName, fileType required' }, { status: 400 });
  }

  // RLS will block if the student doesn't own this submission.
  const { data, error } = await supabase
    .from('submission_files')
    .insert({
      submission_id: body.submissionId,
      file_type: body.fileType,
      file_key: body.key,
      file_url: body.key, // store key in file_url too; we always re-presign on read
      file_name: body.fileName,
      file_size_kb: body.fileSizeKb ?? null,
      label: body.label ?? null,
    })
    .select('id')
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
