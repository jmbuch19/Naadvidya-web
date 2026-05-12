// Shared constants/helpers for class offerings (Workshop / Gurukul / Mehfil series).

export type OfferingType = 'gurukul_path' | 'riyaaz_workshop' | 'mehfil_session';

export const OFFERING_LABELS: Record<OfferingType, { name: string; tagline: string }> = {
  gurukul_path: { name: 'Gurukul Path', tagline: 'Progressive curriculum · weekly sessions · long-term' },
  riyaaz_workshop: { name: 'Riyaaz Workshop', tagline: 'Fixed-scope · topic-focused · 4–12 sessions' },
  mehfil_session: { name: 'Mehfil Series', tagline: 'Curated · short series · 1–5 sessions' },
};

// Music level taxonomy (NAADVIDYA_CLASS_DESIGN.md §2). Index = the integer stored.
export const LEVELS = [
  'Praveshika (Entry)',
  'Prarambhik Pratham',
  'Prarambhik Dwitiya',
  'Madhyama Pratham',
  'Madhyama Dwitiya',
  'Visharad Pratham',
  'Visharad Dwitiya',
  'Alankar & Beyond',
];

export function levelRangeLabel(min: number, max: number): string {
  const m = LEVELS[Math.max(0, Math.min(7, min))];
  const x = LEVELS[Math.max(0, Math.min(7, max))];
  return min === max ? m : `${m} → ${x}`;
}

// Generate session datetimes for a workshop from a start date + recurring weekly
// slots, up to `count` sessions. daysOfWeek: 0=Sun..6=Sat. times: 'HH:MM' (IST-naive).
export function generateWorkshopSchedule(opts: {
  startDate: string;          // 'YYYY-MM-DD'
  daysOfWeek: number[];
  time: string;               // 'HH:MM'
  count: number;
}): string[] {
  const [h, m] = opts.time.split(':').map(Number);
  const out: string[] = [];
  const start = new Date(`${opts.startDate}T00:00:00`);
  const days = [...opts.daysOfWeek].sort((a, b) => a - b);
  if (days.length === 0) return out;

  const cursor = new Date(start);
  let guard = 0;
  while (out.length < opts.count && guard < 4000) {
    guard++;
    if (days.includes(cursor.getDay())) {
      const dt = new Date(cursor);
      dt.setHours(h ?? 19, m ?? 0, 0, 0);
      if (dt >= start) out.push(dt.toISOString());
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
