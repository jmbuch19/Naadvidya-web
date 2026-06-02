import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { logoutAction } from '../../(auth)/actions';

export const metadata = { title: 'Admin · Audit log — Naadvidya' };

// Read-only viewer over audit_logs (migration 0020). Filtering (by actor / action /
// date / entity) is deferred — see the dashboard footer. RLS ("Admin reads all
// audit logs") gates this to owner_admin; we also check explicitly below.

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor: { full_name: string; email: string } | null;
}

const ROW_CAP = 200;

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '—';
}

function fmtJson(v: unknown): string | null {
  if (v == null) return null;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export default async function AdminAuditPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?returnTo=/admin/audit');
  const { data: caller } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle<{ role: string }>();
  if (caller?.role !== 'owner_admin') redirect('/');

  const [{ count: totalCount }, { data: rows }] = await Promise.all([
    supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
    supabase
      .from('audit_logs')
      .select(`
        id, actor_id, actor_role, action, entity_type, entity_id,
        old_value, new_value, ip_address, user_agent, created_at,
        actor:profiles!audit_logs_actor_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(ROW_CAP)
      .returns<AuditRow[]>(),
  ]);

  const events = rows ?? [];
  const distinctActors = new Set(events.map((e) => e.actor_id).filter(Boolean)).size;

  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-line bg-parchment">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/admin/dashboard" className="font-display text-xl text-maroon">नादविद्या</Link>
          <form action={logoutAction}><button type="submit" className="text-sm text-muted-warm hover:text-maroon-mid">Sign out</button></form>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/admin/dashboard" className="text-sm text-muted-warm hover:text-maroon-mid">← Admin</Link>
        <div className="mt-4 mb-10">
          <p className="text-sm text-gold uppercase tracking-widest mb-1">Operations</p>
          <h1 className="font-display text-4xl text-maroon">Audit log</h1>
          <p className="text-muted-warm mt-2 text-sm">
            Append-only trail of significant admin actions — approvals, rejections, payouts,
            role changes. Read-only. Filtering by actor, action, and date comes next; for now
            the {ROW_CAP} most recent events are shown.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <Stat label="Total events" value={(totalCount ?? 0).toLocaleString('en-IN')} accent />
          <Stat label="Shown" value={`${events.length}${(totalCount ?? 0) > events.length ? ` of ${(totalCount ?? 0).toLocaleString('en-IN')}` : ''}`} />
          <Stat label="Distinct actors (shown)" value={distinctActors.toString()} />
        </div>

        <Section title="Recent events" count={events.length}>
          {events.length === 0 ? (
            <Empty>
              No audit events yet. Logging starts from now — approve a teacher or offering,
              mark a payout paid, or change a role, and it will appear here.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-warm">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Entity</th>
                    <th className="py-2 pr-3">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => {
                    const oldJson = fmtJson(e.old_value);
                    const newJson = fmtJson(e.new_value);
                    return (
                      <tr key={e.id} className="border-b border-line/50 align-top">
                        <td className="py-2 pr-3 text-muted-warm text-xs whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="text-ink">{e.actor?.full_name ?? <span className="text-muted-warm">system / deleted</span>}</span>
                          {e.actor_role && <span className="ml-2 text-xs text-muted-warm">{e.actor_role}</span>}
                        </td>
                        <td className="py-2 pr-3"><ActionChip action={e.action} /></td>
                        <td className="py-2 pr-3 text-muted-warm text-xs whitespace-nowrap">
                          {e.entity_type}
                          <span className="ml-1 font-mono text-[11px]">{shortId(e.entity_id)}</span>
                        </td>
                        <td className="py-2 pr-3">
                          {oldJson || newJson ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-warm hover:text-maroon-mid select-none">view</summary>
                              <div className="mt-2 space-y-2">
                                {oldJson && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-warm">before</p>
                                    <pre className="mt-0.5 bg-parchment-2/60 border border-line rounded p-2 overflow-x-auto text-[11px] text-ink">{oldJson}</pre>
                                  </div>
                                )}
                                {newJson && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wide text-muted-warm">after</p>
                                    <pre className="mt-0.5 bg-parchment-2/60 border border-line rounded p-2 overflow-x-auto text-[11px] text-ink">{newJson}</pre>
                                  </div>
                                )}
                                {e.ip_address && <p className="text-[11px] text-muted-warm">IP {e.ip_address}</p>}
                              </div>
                            </details>
                          ) : (
                            <span className="text-muted-warm text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-lg border ${accent ? 'border-gold bg-parchment-2' : 'border-line bg-parchment'} p-5`}><p className="text-xs uppercase tracking-widest text-muted-warm mb-1">{label}</p><p className={`font-display text-2xl ${accent ? 'text-maroon' : 'text-ink'}`}>{value}</p></div>;
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="mb-10"><div className="flex items-baseline justify-between mb-3"><h2 className="font-display text-2xl text-maroon">{title}</h2><span className="text-sm text-muted-warm">{count}</span></div>{children}</section>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="bg-parchment-2/40 border border-dashed border-line rounded-lg p-6 text-center text-muted-warm text-sm">{children}</div>;
}
function ActionChip({ action }: { action: string }) {
  const negative = /reject|delete|remove|cancel|fail/.test(action);
  const cls = negative ? 'bg-red-100 text-red-700' : 'bg-gold/20 text-maroon';
  return <span className={`text-xs px-2 py-0.5 rounded font-mono ${cls}`}>{action}</span>;
}
