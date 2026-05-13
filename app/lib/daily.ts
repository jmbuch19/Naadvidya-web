// Daily.co — video room creation + meeting tokens.
// Rooms are CREATED ONLY AT BOOKING CONFIRMATION (not at request time) because
// rooms have an expiry (we set 2hr post-scheduled-time). Never bulk-create rooms
// at enrollment — see MASTER_SPEC §4 + NAADVIDYA_MISSING_PIECES §2.

const API_BASE = process.env.DAILY_API_BASE ?? 'https://api.daily.co/v1';

function getApiKey(): string | null {
  return process.env.DAILY_API_KEY ?? null;
}

function authHeaders(): HeadersInit {
  const key = getApiKey();
  if (!key) throw new Error('Daily.co not configured — set DAILY_API_KEY');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };
}

export interface DailyRoom {
  name: string;
  url: string;
}

// Create a private 2-participant room. Name is namespaced; expiry is 2h after the
// session ends. Used for Mehfil bookings (prefix 'b') and scheduled sessions (prefix 's').
export async function createRoom(opts: {
  prefix: string;            // short namespace, e.g. 'b' (booking) or 's' (scheduled session)
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
}): Promise<DailyRoom> {
  // Daily room names: lowercase alphanumerics + dashes, ≤ ~40 chars. UUIDs have dashes
  // already; we just take the first chunk to stay short and unique enough.
  const shortId = opts.id.replace(/[^a-z0-9]/gi, '').slice(0, 24).toLowerCase();
  const name = `nv-${opts.prefix}-${shortId}`;
  const exp = Math.floor(opts.scheduledAt.getTime() / 1000) + opts.durationMinutes * 60 + 7200;

  const res = await fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      privacy: 'private',
      properties: {
        enable_chat: true,
        enable_screenshare: false,
        max_participants: 2,
        exp,
      },
    }),
  });

  if (res.status === 400) {
    // Likely "already exists" — fetch it instead of failing.
    const existing = await fetch(`${API_BASE}/rooms/${name}`, { headers: authHeaders() });
    if (existing.ok) {
      const j = await existing.json();
      return { name: j.name, url: j.url };
    }
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily.co room creation failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return { name: json.name, url: json.url };
}

// Back-compat wrapper used by the Mehfil booking-confirm route.
export async function createDailyRoom(opts: {
  bookingId: string;
  scheduledAt: Date;
  durationMinutes: number;
}): Promise<DailyRoom> {
  return createRoom({ prefix: 'b', id: opts.bookingId, scheduledAt: opts.scheduledAt, durationMinutes: opts.durationMinutes });
}

// Generate a meeting token. Teacher = owner/moderator, student = non-owner.
export async function createMeetingToken(opts: {
  roomName: string;
  isTeacher: boolean;
  userName: string;
  expSeconds?: number;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: opts.roomName,
        is_owner: opts.isTeacher,
        user_name: opts.userName,
        exp: opts.expSeconds ?? Math.floor(Date.now() / 1000) + 7200,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily.co token creation failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return json.token;
}

export function isDailyConfigured(): boolean {
  return !!getApiKey();
}
