// Cloudflare R2 — file storage for homework submissions and audio feedback.
// We use the S3-compatible API so the AWS SDK works directly.
//
// Key conventions (NAADVIDYA_VOICE_REPO_AND_PLUGINS.md + MASTER_SPEC.md):
//   submissions/{submissionId}/{timestamp}-{label}.{ext}       student submission files
//   feedback/{submissionId}/{timestamp}-audio.{ext}             teacher audio feedback notes
//   voice-repo/{teacherId}/{uuid}.{ext}                         Phase 1.5: teacher reference recordings
//
// All files are PRIVATE. Reads use presigned GET URLs (1-hour expiry).
// Writes use presigned PUT URLs (5-minute expiry) so the browser uploads directly.

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let cachedClient: S3Client | null = null;

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  if (!isR2Configured()) {
    throw new Error('R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  }
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

// Sanitize a label to be safe in an object key.
function safeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
}

function extFromContentType(contentType: string, fallback = 'bin'): string {
  const map: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'text/plain': 'txt',
  };
  return map[contentType] ?? fallback;
}

export function buildSubmissionKey(opts: {
  submissionId: string;
  label: string;
  contentType: string;
}): string {
  const ext = extFromContentType(opts.contentType);
  return `submissions/${opts.submissionId}/${Date.now()}-${safeLabel(opts.label)}.${ext}`;
}

export function buildFeedbackAudioKey(submissionId: string, contentType: string): string {
  const ext = extFromContentType(contentType, 'webm');
  return `feedback/${submissionId}/${Date.now()}-audio.${ext}`;
}

// 5-minute expiry — long enough for the user to upload, short enough that a leaked
// URL has limited value.
export async function presignUpload(opts: {
  key: string;
  contentType: string;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 300 });
}

// 1-hour expiry for downloads. Re-generate on each page load.
export async function presignRead(key: string, opts?: { downloadAs?: string }): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ResponseContentDisposition: opts?.downloadAs
      ? `attachment; filename="${opts.downloadAs.replace(/"/g, '')}"`
      : undefined,
  });
  return getSignedUrl(getClient(), cmd, { expiresIn: 3600 });
}

export async function deleteObject(key: string): Promise<void> {
  if (!isR2Configured()) return;
  const cmd = new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key });
  await getClient().send(cmd);
}
