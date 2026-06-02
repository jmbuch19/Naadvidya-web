import { createServiceRoleClient } from '@/lib/supabase/server';

// Append-only audit trail of significant actions (migration 0020_audit_logs).
// Best-effort: a failed audit write must NEVER fail the action it records, so
// every call is wrapped and only logged to the server console on error.
//
// `action` convention: '<entity>.<verb>' e.g. 'teacher.approved',
// 'offering.rejected', 'payout.marked_paid', 'profile.role_changed'.

interface LogAuditArgs {
  /** The incoming request — used to capture IP + user-agent. Optional. */
  req?: Request;
  actorId: string;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

function clientIp(headers: Headers | undefined): string | null {
  if (!headers) return null;
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return headers.get('x-real-ip');
}

export async function logAudit(args: LogAuditArgs): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    const headers = args.req?.headers;
    await admin.from('audit_logs').insert({
      actor_id: args.actorId,
      actor_role: args.actorRole ?? null,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId ?? null,
      old_value: args.oldValue ?? null,
      new_value: args.newValue ?? null,
      ip_address: clientIp(headers),
      user_agent: headers?.get('user-agent') ?? null,
    });
  } catch (e) {
    console.error('[audit] log failed:', e);
  }
}
