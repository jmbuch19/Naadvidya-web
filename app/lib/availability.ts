// Helpers for converting teacher_availability (recurring weekly slots in teacher's
// timezone) into concrete bookable slots for the next N days.
//
// Phase 1: timezone-naive display (we show the teacher's local time). Phase 1.5
// will add per-student timezone conversion via date-fns-tz.

export interface AvailabilityRow {
  day_of_week: number;       // 0 = Sunday … 6 = Saturday
  start_time: string;        // 'HH:MM:SS' or 'HH:MM'
  end_time: string;
  timezone: string;          // IANA, e.g. 'Asia/Kolkata'
  is_active: boolean;
}

export interface Slot {
  startISO: string;          // UTC ISO string
  endISO: string;
  label: string;             // 'Tue, 7:00 PM' in teacher tz
  durationMinutes: number;
}

// Generate slots for the next `days` days, broken into `chunkMinutes` increments
// inside each availability window. Skips slots in the past.
export function generateSlots(opts: {
  availability: AvailabilityRow[];
  days?: number;
  chunkMinutes?: number;
  now?: Date;
}): Slot[] {
  const days = opts.days ?? 14;
  const chunkMinutes = opts.chunkMinutes ?? 60;
  const now = opts.now ?? new Date();

  const slots: Slot[] = [];

  for (const av of opts.availability) {
    if (!av.is_active) continue;
    const [sh, sm] = av.start_time.split(':').map(Number);
    const [eh, em] = av.end_time.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin <= startMin) continue;

    for (let d = 0; d < days; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      if (date.getUTCDay() !== av.day_of_week) {
        // Note: teacher's day_of_week is in their TZ. For Phase 1 IST-only, UTC ~= IST shifted,
        // so we approximate. Phase 1.5 will use proper TZ conversion.
        if (date.getDay() !== av.day_of_week) continue;
      }

      for (let m = startMin; m + chunkMinutes <= endMin; m += chunkMinutes) {
        const startDt = new Date(date);
        startDt.setHours(Math.floor(m / 60), m % 60, 0, 0);
        const endDt = new Date(startDt.getTime() + chunkMinutes * 60_000);
        if (startDt <= now) continue;
        slots.push({
          startISO: startDt.toISOString(),
          endISO: endDt.toISOString(),
          durationMinutes: chunkMinutes,
          label: formatSlotLabel(startDt, av.timezone),
        });
      }
    }
  }

  // De-dupe and sort
  const seen = new Set<string>();
  return slots
    .filter((s) => {
      if (seen.has(s.startISO)) return false;
      seen.add(s.startISO);
      return true;
    })
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
}

function formatSlotLabel(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}
