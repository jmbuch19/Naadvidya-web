# NAADVIDYA — Missing Pieces & Additions
## Everything not in MASTER_SPEC or CLAUDE_CODE_PROMPT
## Version 1.0

---

## 1. BOOKING FLOW — THREE DIRECTIONS, NOT ONE

### 1A. Mehfil Session — Student initiates
```
Student finds teacher → views availability → selects slot →
credits deducted → booking created (status: pending) →
Teacher notified (WhatsApp + email) within 24hr →
Teacher confirms → Daily.co room created →
Both get join links → session
```

### 1B. Riyaaz Workshop — Teacher creates block, student enrolls
```
Teacher creates Workshop (title, dates, price, session count) →
Amee approves → published on platform →
Student browses workshops → enrolls (all credits reserved) →
All sessions pre-scheduled, all rooms created at enrollment →
Each session: auto-reminders → session → next session
No per-session confirmation needed.
```

### 1C. Gurukul Path — Teacher owns the schedule
```
Teacher creates Programme → Amee approves →
Student applies (short written intent) → Teacher accepts →
Teacher and student agree on recurring day/time →
Teacher creates BULK schedule (see Section 2) →
All sessions generated for the term →
Student receives full calendar →
Each session: auto-reminders → session → homework assigned →
student submits → teacher reviews → next session
```

### Key decision on teacher profile:
Add `auto_confirm` boolean to `teacher_profiles`:
- `false` (default for Mehfil): teacher manually confirms each booking request
- `true` (set by teacher optionally): bookings within available slots are auto-confirmed,
  room created immediately, teacher just needs to show up

---

## 2. BULK SCHEDULING — TEACHER CREATES 6 MONTHS IN ADVANCE

### UI: Teacher Bulk Schedule Creator
Teacher inputs:
- Student (dropdown from enrolled students)
- Recurring day(s): e.g. Tuesday, Thursday
- Time: e.g. 7:00 PM IST
- Duration: 60 minutes
- Start date: e.g. 1 June 2026
- End date: e.g. 30 November 2026 (auto-calculates: 52 sessions)
- Exclude dates: pre-populated with teacher's marked holidays (teacher can add more)

System generates:
- All N `scheduled_sessions` rows in one operation
- Skips any dates in `teacher_holidays` table
- Skips Indian national holidays if teacher has opted in
- Shows teacher a preview list before confirming ("52 sessions will be created. Dates: ...")
- On confirm: all sessions created, Daily.co rooms created lazily (24hr before each session,
  not all at once — Daily.co rooms expire)

### API route: POST /api/sessions/bulk-create
```typescript
body: {
  enrollmentId: string,
  studentId: string,
  teacherId: string,
  daysOfWeek: number[],    // [2, 4] = Tuesday, Thursday
  startTime: string,       // "19:00" in teacher's timezone
  teacherTimezone: string, // "Asia/Kolkata"
  startDate: string,       // "2026-06-01"
  endDate: string,         // "2026-11-30"
  excludeDates: string[],  // ["2026-08-15", "2026-10-20", ...]
}
```

Returns: array of created session IDs + count + skipped dates.

### Cron job: Daily.co room creation
Run daily at 6:00 AM IST:
- Find all `scheduled_sessions` WHERE `scheduled_at` is within next 24 hours
  AND `daily_room_name IS NULL`
  AND `status = 'upcoming'`
- Call Daily.co API to create room for each
- Update `scheduled_sessions` with room details
- Send 24-hour reminder notifications

---

## 3. TIMEZONE — COMPLETE ARCHITECTURE

### Rule 1: Store everything in UTC
- `scheduled_at` in `scheduled_sessions` and `bookings`: UTC timestamp
- `teacher_availability.start_time` and `end_time`: stored in the teacher's timezone
  (because "Tuesday 7pm" is a recurring local-time concept, not a UTC moment)

### Rule 2: User profile stores IANA timezone string
Add `timezone` field to `profiles` table:
```sql
ALTER TABLE profiles ADD COLUMN timezone text DEFAULT 'Asia/Kolkata';
```

### Rule 3: Auto-detect on registration, allow override
```typescript
// On registration form (client-side):
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Pre-fill timezone field, user can change
```

### Rule 4: Display rules
- Teacher dashboard: always show times in IST (teacher is in India)
- Student dashboard: always show times in student's profile timezone
- All reminder notifications: show time in recipient's timezone
- Booking confirmation email: show BOTH timezones ("7:00 PM IST / 2:30 PM BST")

### Rule 5: Availability display conversion
When student browses teacher availability:
```typescript
import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

// Teacher has "Tuesday 19:00 IST" as availability
// Student's timezone is "America/New_York"
// Convert: Tuesday 19:00 IST → Tuesday 08:30 EST
```

### Library: date-fns-tz
```bash
npm install date-fns date-fns-tz
```

### Gotcha: 30-minute offset timezones
India is UTC+5:30. A student in a full-hour timezone (EST = UTC-5) booking a teacher in IST
will see "8:30 AM" not "8:00 AM" or "9:00 AM". Handle this — do not round to the hour.

---

## 4. ADMIN DASHBOARD — FULL SPEC

Amee's admin panel is not just a data table. It is her operational control room.

### 4.1 Today's View (default landing page)
Shows:
- Sessions happening today (all teachers, all students), live badge on active sessions
- Pending booking requests (student-initiated, awaiting teacher confirm) — with 24hr countdown
- Teacher applications awaiting review
- Disputes requiring attention
- Payout reminder if today is 1st or 15th

### 4.2 Teachers
- Tab 1: Approval queue (pending applications — name, qualifications, applied date, Approve/Reject buttons)
- Tab 2: Active teachers (name, specialisation, upcoming sessions this week, earnings MTD, status badge)
- Tab 3: Suspended/rejected
- Each teacher row: click → full teacher profile view with all their sessions, earnings, disputes

### 4.3 Students
- List: name, registered date, credit balance, sessions completed, last active
- Click → student detail: credit history, all sessions, all assignments, any disputes

### 4.4 Sessions
- Calendar view (week/month toggle) showing all sessions across all teachers
- Filter: by teacher, by status (upcoming/completed/cancelled/no-show)
- List view: sortable by date, teacher, student, status
- Click → session detail with join links, payout record, assignment/submission status

### 4.5 Revenue & Payouts
- Cards at top: Gross this month / Platform 20% this month / Teacher payouts due / Paid this month
- Payout queue: teacher name, sessions count, gross, platform cut, amount due, UPI/bank, "Mark Paid" button
- Payout history: all past payouts with reference numbers
- Export to CSV for accounting

### 4.6 Disputes
- Open disputes list with type, raised by, against, raised date, days open
- Click → full dispute thread, audit evidence, resolve/escalate buttons

### 4.7 Platform Settings (Amee only)
- Credit pack prices (edit Ek Swar, Char Prahar, etc.)
- Session fee range (min/max for teacher fee setting)
- Notification toggle per event type (email on/off, WhatsApp on/off)
- Indian national holidays list (add/remove from calendar)
- Goodwill credit distributor (select student, add N credits, write reason)

### 4.8 Audit Log
- Filter by actor, action type, date range
- Expandable rows with JSON diff
- Export to CSV

---

## 5. WHATSAPP IMPLEMENTATION NOTES

### Option A: Reuse EdUsaathiAI Meta Business account
If Jaydeep's Meta Business account is already verified and active:
- Create a new WhatsApp Business number for Naadvidya (separate from EdUsaathiAI)
- Submit Naadvidya-specific message templates for pre-approval
- Templates to submit first (highest priority):
  1. `booking_confirmed` — booking confirmation with date/time/teacher
  2. `session_reminder_1hr` — 1hr reminder with join link
  3. `assignment_posted` — homework assigned notification
  4. `teacher_new_request` — new booking request for teacher
  5. `payment_received` — credit purchase confirmation

### Option B: Fresh Meta Business setup
- Register business at business.facebook.com
- Meta verification: 2–4 weeks. PLAN AROUND THIS.
- Apply for WhatsApp Business API through Meta Cloud
- Get phone number approved (must be a number not already on WhatsApp)
- Submit all templates for approval (3–5 business days each)

### Fallback: if WhatsApp not ready at launch
All WhatsApp notifications fall back to email automatically.
No user-facing experience is blocked. Build the fallback from Day 1.

### Implementation: Meta Cloud API
```typescript
// lib/whatsapp.ts
export async function sendWhatsApp(to: string, templateName: string, params: string[]) {
  if (!process.env.META_WHATSAPP_TOKEN) {
    // Graceful fallback — log and skip, don't throw
    console.warn('WhatsApp not configured — skipping WA notification');
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.startsWith('+') ? to : `+91${to}`,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: params.map(p => ({ type: 'text', text: p })),
          }],
        },
      }),
    }
  );

  return res.json();
}
```

### WhatsApp number storage
Add to `profiles` table:
```sql
ALTER TABLE profiles ADD COLUMN whatsapp_number text;
ALTER TABLE profiles ADD COLUMN whatsapp_opted_in boolean DEFAULT false;
```
Never send WhatsApp to a number without `whatsapp_opted_in = true`.

---

## 6. CRON JOBS NEEDED

These must run on schedule. Use Vercel Cron, Netlify Scheduled Functions, or pg_cron on Supabase.

| Job | Schedule | Action |
|---|---|---|
| `session-reminders-24hr` | Every hour | Find sessions 24hr away, send reminders if not sent |
| `session-reminders-1hr` | Every 15 min | Find sessions 60min away, send WA reminder |
| `session-starting` | Every 5 min | Find sessions 5min away, send "starting now" WA |
| `daily-room-creation` | 6:00 AM IST daily | Create Daily.co rooms for next 24hr sessions |
| `homework-due-reminder` | 8:00 AM IST daily | Find assignments due tomorrow, remind students |
| `homework-overdue-teacher` | 6:00 AM IST daily | Flag submissions unreviewed for 48hr |
| `low-credits-check` | Daily | Find students with balance = 1, send WA nudge |
| `daily-admin-digest` | 9:00 AM IST daily | Email Amee platform summary |
| `payout-reminder` | 1st & 15th, 8am | WA Amee: payout day reminder |
| `booking-timeout` | Every 30 min | Auto-cancel unconfirmed bookings >24hr old, refund credits |

Each cron route must verify `CRON_SECRET` header before executing.

---

## 7. THINGS STILL MISSING — PRIORITY FLAGS

### 🔴 Must have before launch
- **Free 15-minute intro call** — Student can book one free trial session per teacher (15 min, no credit cost). This is Naadvidya's most powerful acquisition tool. Teacher gets ₹0 but gains a student. Add `is_trial` boolean to bookings. Max one trial per student-teacher pair.
- **Student level intake form** — On registration, 5 questions about prior music learning. Result routes student to recommended level + sends Amee an intake summary. Simple form, no AI needed.
- **Mobile video room** — Daily.co iframe on iOS/Android browsers needs specific handling. `allow="camera; microphone"` permissions behave differently on Safari iOS. Test explicitly.
- **Privacy Policy** — Legal page. Must be live before any user data is collected. Covers DPDP Act 2023 (India) and GDPR (for international students). Draft needed.
- **Cookie Policy** — Simpler than Privacy Policy. Required for any analytics (GA4 etc.).
- **Data deletion mechanism** — DPDP Act 2023 gives Indian users the right to delete their data. A "Delete my account" button in settings that anonymises their data is required before launch.

### 🟡 Should have within first month
- **Teacher waitlist** — If a teacher's next 2 weeks are fully booked, student can join waitlist. When a slot opens (cancellation), waitlisted students are notified.
- **SEO for teacher profiles** — Every `/teachers/[slug]` page needs proper `<title>`, `<meta description>`, JSON-LD structured data. Amee Buch's name must appear in Google search results.
- **Session notes** — Both teacher and student can add private session notes (visible only to themselves) after each session. Not homework — personal reference notes.
- **Student onboarding email sequence** — 3 emails over first week: (1) Welcome, (2) How to choose a teacher, (3) What to expect in your first session.
- **Teacher onboarding email sequence** — 3 emails after approval: (1) You're approved — go live checklist, (2) Set your availability, (3) Your first student guide.

### 🟢 Phase 2 items (captured here so they're not forgotten)
- Teacher ratings (1–5 stars, visible only to Amee in Phase 1, public in Phase 2)
- Annual tax receipt for students (education expenditure documentation)
- GST registration when revenue crosses ₹20L annually
- Multi-language UI: Hindi/Gujarati toggle
- Supabase point-in-time recovery configuration
- Group masterclass sessions (one teacher, up to 15 students)
- Recording archive subscription (₹299/month for access to all past session recordings)
- Stripe for international payments

---

## 8. UPDATE REQUIRED IN CLAUDE_CODE_PROMPT.md

Add to Step 2 (Supabase setup):
```sql
ALTER TABLE profiles ADD COLUMN timezone text DEFAULT 'Asia/Kolkata';
ALTER TABLE profiles ADD COLUMN whatsapp_number text;
ALTER TABLE profiles ADD COLUMN whatsapp_opted_in boolean DEFAULT false;
```

Add to teacher_profiles:
```sql
ALTER TABLE teacher_profiles ADD COLUMN auto_confirm boolean DEFAULT false;
```

Add to packages to install:
```bash
npm install date-fns date-fns-tz
npm install axios  # For Meta Cloud API calls (or use native fetch)
```

Add to BUILD ORDER after Step 8 (Homework loop):
```
STEP 9: Notification system
  → lib/whatsapp.ts (with graceful fallback)
  → lib/notifications.ts (unified send: email + WA)
  → All existing routes updated to call lib/notifications.ts after key actions
  → Cron job routes created (/api/cron/*)
  → Test: booking created → both parties notified

STEP 10: Admin dashboard (full spec — see MISSING_PIECES.md Section 4)

STEP 11: Timezone
  → User profile timezone field + auto-detect on registration
  → All session times displayed in recipient's timezone
  → Teacher availability converted for student display
```
