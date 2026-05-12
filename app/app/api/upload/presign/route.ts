import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isR2Configured, presignUpload, buildSubmissionKey, buildFeedbackAudioKey } from '@/lib/r2';

// Generate a presigned PUT URL so the browser can upload a file directly to R2.
//
// Two kinds of uploads are supported:
//   kind: 'submission' — student uploading homework. Requires submissionId
//                        that the student owns.
//   kind: 'feedback'   — teacher uploading an audio feedback note. Requires
//                        submissionId from an assignment they own.

interface Body {
  kind?: 'submission' | 'feedback';
  submissionId?: string;
  label?: string;            // e.g. 'Yaman recording' — used in the object key
  contentType?: string;      // MIME type
  fileSizeKb?: number;
}

const MAX_FILE_SIZE_KB = 50_000; // 50 MB cap

interface SubmissionRow {
  id: string;
  student_id: string;
  assignment: { teacher_id: string };
}

export async function POST(req: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: 'File storage not configured — set R2_* env vars to enable uploads' },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.kind || !body.submissionId || !body.contentType || !body.label) {
    return NextResponse.json({ error: 'kind, submissionId, contentType, label required' }, { status: 400 });
  }

  if (body.fileSizeKb && body.fileSizeKb > MAX_FILE_SIZE_KB) {
    return NextResponse.json({ error: `File too large — max ${MAX_FILE_SIZE_KB} KB` }, { status: 413 });
  }

  // Verify the caller has rights on this submission.
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, student_id, assignment:assignments!submissions_assignment_id_fkey(teacher_id)')
    .eq('id', body.submissionId)
    .maybeSingle<SubmissionRow>();

  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  if (body.kind === 'submission') {
    if (submission.student_id !== user.id) {
      return NextResponse.json({ error: 'Not your submission' }, { status: 403 });
    }
  } else {
    // 'feedback' — verify caller is the teacher on the assignment
    const teacherIdOnAssignment = submission.assignment?.teacher_id;
    if (!teacherIdOnAssignment) {
      return NextResponse.json({ error: 'Could not verify assignment ownership' }, { status: 500 });
    }
    const { data: teacherProfile } = await supabase
      .from('teacher_profiles')
      .select('id')
      .eq('id', teacherIdOnAssignment)
      .eq('profile_id', user.id)
      .maybeSingle();
    if (!teacherProfile) {
      return NextResponse.json({ error: 'Only the assigning teacher can upload feedback audio' }, { status: 403 });
    }
  }

  const key = body.kind === 'submission'
    ? buildSubmissionKey({ submissionId: body.submissionId, label: body.label, contentType: body.contentType })
    : buildFeedbackAudioKey(body.submissionId, body.contentType);

  let uploadUrl: string;
  try {
    uploadUrl = await presignUpload({ key, contentType: body.contentType });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Presign failed' }, { status: 500 });
  }

  return NextResponse.json({ uploadUrl, key });
}
