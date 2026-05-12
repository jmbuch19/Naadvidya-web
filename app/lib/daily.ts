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

// Create a private 2-participant room expiring 2 hours after the scheduled session.
export async function createDailyRoom(opts: {
  bookingId: string;
  scheduledAt: Date;
  durationMinutes: number;
}): Promise<DailyRoom> {
  const name = `naadvidya-${opts.bookingId}`;
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily.co room creation failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  return { name: json.name, url: json.url };
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
