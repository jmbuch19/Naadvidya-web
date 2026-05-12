# NAADVIDYA — Master Specification v1.0
> India's Premier Online Classical Music Academy
> Hosted by Mrs. Amee Buch, Sangeet Visharad
> Built by Jaydeep Buch | Claude Code

---

## 0. NORTH STAR

Naadvidya is a curated, invitation-only teacher marketplace for Indian Classical music at Visharad level and beyond. It is not a YouTube. It is not a hobbyist platform. Every design and technical decision must protect that positioning.

---

## 1. ROLES

| Role | Description | Revenue |
|---|---|---|
| `owner_admin` | Amee Buch. Full platform control. Can also teach. | 100% (no split) |
| `teacher` | Approved by Amee. Creates profile, teaches, posts assignments, reviews homework. | 80% of session fee |
| `student` | Registers, buys credits, books sessions, submits homework. | Pays |

**Rule:** `is_owner` boolean on Amee's profile. Any teacher with `is_owner = true` skips the 80/20 split entirely and receives full session amount.

---

## 2. DATABASE SCHEMA

### 2.1 `profiles`
```sql
id              uuid PRIMARY KEY references auth.users(id)
full_name       text NOT NULL
email           text NOT NULL
avatar_url      text
role            text CHECK (role IN ('owner_admin', 'teacher', 'student'))
is_owner        boolean DEFAULT false  -- only Amee
phone           text
city            text
country         text
created_at      timestamptz DEFAULT now()
```

### 2.2 `teacher_profiles`
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
profile_id          uuid REFERENCES profiles(id)
bio                 text
years_experience    integer
sangeet_qualifications text[]  -- e.g. ['Sangeet Visharad', 'Sangeet Alankar']
specializations     text[]    -- e.g. ['Khayal', 'Thumri', 'Tabla', 'Bansuri']
ragas_taught        text[]    -- e.g. ['Yaman', 'Bhairav', 'Desh']
languages           text[]    -- teaching languages
session_fee_inr     numeric   -- per session price in INR
intro_video_url     text      -- optional 2-min intro video
approval_status     text CHECK (status IN ('pending', 'approved', 'rejected'))
approved_by         uuid REFERENCES profiles(id)  -- Amee's ID
approved_at         timestamptz
is_visible          boolean DEFAULT false  -- flips true after approval
created_at          timestamptz DEFAULT now()
```

### 2.3 `teacher_availability`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
teacher_id      uuid REFERENCES teacher_profiles(id)
day_of_week     integer  -- 0=Sunday ... 6=Saturday
start_time      time
end_time        time
timezone        text DEFAULT 'Asia/Kolkata'
is_active       boolean DEFAULT true
```

### 2.4 `session_packages`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text   -- e.g. 'Starter Pack', 'Monthly Sadhana'
credits         integer  -- number of sessions
price_inr       numeric
is_active       boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```
**Starter packs (suggested):**
- Ek Swar — 2 sessions — ₹999
- Char Prahar — 4 sessions — ₹1,799
- Ashtadhatu — 8 sessions — ₹3,299
- Maas Sadhana — 12 sessions — ₹4,799

### 2.5 `student_credits`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id      uuid REFERENCES profiles(id)
credits_balance integer DEFAULT 0
updated_at      timestamptz DEFAULT now()
```

### 2.6 `credit_transactions`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id      uuid REFERENCES profiles(id)
type            text CHECK (type IN ('purchase', 'debit', 'refund'))
credits         integer
razorpay_order_id   text
razorpay_payment_id text
package_id      uuid REFERENCES session_packages(id)
note            text
created_at      timestamptz DEFAULT now()
```

### 2.7 `bookings`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
student_id      uuid REFERENCES profiles(id)
teacher_id      uuid REFERENCES teacher_profiles(id)
requested_at    timestamptz
scheduled_at    timestamptz
duration_minutes integer DEFAULT 60
status          text CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'))
daily_room_url  text   -- Daily.co room URL generated on confirm
student_join_url    text
teacher_join_url    text
notes_to_teacher    text  -- student's pre-session note
credits_deducted    integer DEFAULT 1
created_at      timestamptz DEFAULT now()
```

### 2.8 `assignments`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
booking_id      uuid REFERENCES bookings(id)
teacher_id      uuid REFERENCES teacher_profiles(id)
student_id      uuid REFERENCES profiles(id)
title           text  -- e.g. "Week 3 Practice — Yaman"
description     text  -- e.g. "Next class: bring Yaman aaroha recording, Tanpura notes, short Thumri"
deliverables    text[]  -- ['Yaman recording', 'Tanpura notes', 'Thumri piece']
due_before      timestamptz  -- usually the next session time
created_at      timestamptz DEFAULT now()
```

### 2.9 `submissions`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
assignment_id   uuid REFERENCES assignments(id)
student_id      uuid REFERENCES profiles(id)
submitted_at    timestamptz DEFAULT now()
status          text CHECK (status IN ('submitted', 'reviewed'))
```

### 2.10 `submission_files`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
submission_id   uuid REFERENCES submissions(id)
file_type       text CHECK (type IN ('audio', 'pdf', 'image', 'text'))
file_url        text   -- Cloudflare R2 signed URL
file_name       text
file_size_kb    integer
label           text   -- e.g. 'Yaman Recording', 'Tanpura Notes'
uploaded_at     timestamptz DEFAULT now()
```

### 2.11 `feedback`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
submission_id   uuid REFERENCES submissions(id)
teacher_id      uuid REFERENCES teacher_profiles(id)
feedback_text   text
feedback_audio_url  text   -- optional voice note from teacher (R2)
created_at      timestamptz DEFAULT now()
```

### 2.12 `payouts`
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
teacher_id      uuid REFERENCES teacher_profiles(id)
booking_id      uuid REFERENCES bookings(id)
gross_amount    numeric  -- full session fee
platform_cut    numeric  -- 20%
teacher_amount  numeric  -- 80%
status          text CHECK (status IN ('pending', 'paid'))
paid_at         timestamptz
upi_or_bank_ref text
created_at      timestamptz DEFAULT now()
```

---

## 3. TECH STACK

| Layer | Tool | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Known stack, SSR, API routes |
| Database + Auth | Supabase | Auth, Postgres, Storage, RLS |
| File Storage | Cloudflare R2 | Cheap audio/PDF storage |
| Video Sessions | Daily.co | Embeddable, pay-per-minute, recording API |
| Payments | Razorpay (Phase 1) | India-first |
| Payments | Stripe slot reserved | Global students Phase 2 |
| Email | Resend | Booking confirmations, assignments |
| Deployment | Netlify | Known, free tier |
| Domain | Post-localhost | Purchase after MVP confirmed |

**Payment Architecture Note:** Razorpay webhook → credits added → `credit_transactions` logged. Stripe integration is a parallel code path — no rewrite needed.

---

## 4. VIDEO SESSION FLOW (Daily.co)

```
Student books session (credits deducted)
  ↓
Teacher confirms
  ↓
System calls Daily.co API → creates private room
  → Generates student join link
  → Generates teacher join link (with moderator rights)
  ↓
Both links stored in bookings table
  ↓
Reminder email sent 1 hour before (Resend)
  ↓
At session time → Both click their link → Room opens inside Naadvidya (iframe)
  ↓
Session ends → Teacher posts Assignment
  ↓
Booking status → 'completed'
  ↓
Payout record created (80% queued for teacher)
```

---

## 5. HOMEWORK / ASYNC LOOP FLOW

```
Teacher posts Assignment (after session)
  → Title + Description + Deliverables list + Due date
  ↓
Student notified (email + in-app)
  ↓
Student submits before next class:
  → Uploads audio files (voice recordings)
  → Uploads PDF/image (written notes)
  → Each file tagged to a deliverable
  ↓
Teacher reviews async:
  → Sees each deliverable file
  → Leaves text feedback OR records voice note
  ↓
Student notified: "Your homework has been reviewed"
  ↓
Next session begins with full context
```

---

## 6. HERO PAGE DESIGN SPEC

**Structure (top to bottom):**

1. **Nav** — Logo "Naadvidya" (Devanagari + English) | About | Teachers | Login | "Start Learning" CTA

2. **Hero Banner** — Full-width. Amee Buch centred. Tagline: *"सुर से सुर मिलाओ — Learn Classical Music from India's Finest Gurus"*. Subtle tanpura drone texture background. No stock photos.

3. **Amee's Block** — Her photo, "Sangeet Visharad | Founder, Naadvidya" | 2-line vision statement. This is trust anchor, NOT a teacher card.

4. **"Meet Your Gurus" Grid** — Dynamic 3-column card grid.
   - Shows approved teachers (any count).
   - Each card: Photo + Name + Specialisation tags + "View Profile" button.
   - If < 6 teachers: remaining slots show "Joining Soon" silhouette cards.
   - No hardcoded "10 teachers" assumption.

5. **How It Works** — 4 steps: Browse → Book → Learn → Practice.

6. **Footer** — Contact | Instagram | Privacy | © Naadvidya

---

## 7. ADMIN DASHBOARD (Amee)

- Teacher approval queue (pending → approve / reject)
- All bookings (today, upcoming, past)
- Revenue overview (gross, platform 20%, teacher payouts)
- Student list
- Payout management (mark teacher paid)
- Assignment submissions overview

---

## 8. TEACHER DASHBOARD

- Profile edit + availability management
- Upcoming bookings
- Assignment creator (post-session)
- Homework inbox (student submissions to review)
- Earnings tracker (session-by-session)

---

## 9. STUDENT DASHBOARD

- Browse & filter teachers (by specialisation, raga, language, fee)
- Credit balance + buy more
- Upcoming sessions (with join link)
- Assignment inbox (what's pending to submit)
- Submission history + teacher feedback

---

## 10. PHASE PLAN

### Phase 1 — MVP (Localhost → Live)
- [ ] Supabase project + all migrations
- [ ] Auth (Supabase) with role assignment
- [ ] Teacher profile creation + Amee approval flow
- [ ] Student onboarding + credit purchase (Razorpay)
- [ ] Session booking (student requests → teacher confirms)
- [ ] Daily.co room generation on confirm
- [ ] Video session iframe embed
- [ ] Post-session: Assignment creation by teacher
- [ ] Student submission (audio + notes via R2)
- [ ] Teacher feedback (text + optional voice note)
- [ ] Email notifications (Resend) — booking, assignment, feedback
- [ ] Hero page + Teacher grid (dynamic)
- [ ] Admin dashboard (Amee)
- [ ] Teacher dashboard
- [ ] Student dashboard

### Phase 2 — Growth
- [ ] Stripe (global payments)
- [ ] Automated teacher payouts
- [ ] Recording archive per student
- [ ] Teacher rating / testimonials
- [ ] Formal grading rubric (if needed)

### Phase 3 — Scale
- [ ] Expo mobile app
- [ ] Carnatic vertical
- [ ] Group masterclass sessions

---

## 11. DESIGN TOKENS

```css
--color-bg:           #FAF3E0;   /* Ivory parchment */
--color-primary:      #8B1A1A;   /* Raga maroon */
--color-accent:       #C5A028;   /* Gold */
--color-saffron:      #E07B39;   /* Warm saffron */
--color-text:         #1A0A00;   /* Deep brown-black */
--color-muted:        #7A6652;   /* Aged parchment text */

--font-display:       'Cormorant Garamond', serif;
--font-body:          'Plus Jakarta Sans', sans-serif;
```

---

## 12. KEY DECISIONS LOG

| Decision | Choice | Reason |
|---|---|---|
| Video provider | Daily.co | Embeddable, pay-per-use, no monthly lock |
| Payment Phase 1 | Razorpay only | India-first, Stripe slot reserved |
| Payment model | Session credits (packs) | Marketplace with multi-teacher |
| Amee's revenue | 100% (owner exempt) | is_owner = true skips split |
| Teacher approval | Manual by Amee | Curated quality control |
| Exam system | Not in Phase 1 | Replaced by Assignment→Submission→Feedback loop |
| Hero teacher count | Dynamic grid | Works at any count, "Joining Soon" placeholders |
| Domain | Post-localhost | Buy after MVP confirmed live |

---

*Document version: 1.0 | Created: May 2026 | Next: Claude Code prompt*
