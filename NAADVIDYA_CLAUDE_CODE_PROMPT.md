# NAADVIDYA — Claude Code Build Prompt
## Version 1.0 | Phase 1 MVP
> Hand this file to Claude Code as the first message. Nothing else needed.

---

## WHO YOU ARE BUILDING FOR

You are building **Naadvidya** — India's premier online Indian Classical music academy, hosted by **Mrs. Amee Buch, Sangeet Visharad**. This is a curated, invitation-only teacher marketplace for Visharad-level and beyond students. It is not a hobbyist app. Every decision must protect that positioning.

Read this entire document before writing one line of code.

---

## TECH STACK

| Layer | Tool | Version |
|---|---|---|
| Framework | Next.js | 14 (App Router, TypeScript) |
| Database + Auth | Supabase | Latest |
| File Storage | Cloudflare R2 | Via AWS S3 SDK |
| Video Sessions | Daily.co | REST API + iframe embed |
| Payments | Razorpay | Standard checkout |
| Email | Resend | With React Email templates |
| Deployment | Netlify | (post-localhost) |

---

## ENVIRONMENT VARIABLES NEEDED

Create `.env.local` with these. Do NOT hardcode any of these values.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=naadvidya-files
R2_PUBLIC_URL=

# Daily.co
DAILY_API_KEY=
DAILY_API_BASE=https://api.daily.co/v1

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@naadvidya.in

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## DATABASE MIGRATIONS

Run these in Supabase SQL editor in exact order. Do not skip or reorder.

### Migration 001 — profiles
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  avatar_url text,
  role text NOT NULL CHECK (role IN ('owner_admin', 'teacher', 'student')),
  is_owner boolean DEFAULT false,
  phone text,
  city text,
  country text DEFAULT 'India',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles readable"
  ON profiles FOR SELECT USING (true);
```

### Migration 002 — teacher_profiles
```sql
CREATE TABLE teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bio text,
  years_experience integer DEFAULT 0,
  sangeet_qualifications text[] DEFAULT '{}',
  specializations text[] DEFAULT '{}',
  ragas_taught text[] DEFAULT '{}',
  languages text[] DEFAULT '{Hindi,English}',
  session_fee_inr numeric NOT NULL DEFAULT 800,
  intro_video_url text,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_note text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  is_visible boolean DEFAULT false,
  slug text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved teachers visible to all"
  ON teacher_profiles FOR SELECT
  USING (is_visible = true OR profile_id = auth.uid());

CREATE POLICY "Teachers can update own profile"
  ON teacher_profiles FOR UPDATE
  USING (profile_id = auth.uid());

CREATE POLICY "Admin can do everything on teacher_profiles"
  ON teacher_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));
```

### Migration 003 — teacher_availability
```sql
CREATE TABLE teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text DEFAULT 'Asia/Kolkata',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability readable by all"
  ON teacher_availability FOR SELECT USING (true);

CREATE POLICY "Teachers manage own availability"
  ON teacher_availability FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );
```

### Migration 004 — session_packages
```sql
CREATE TABLE session_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  credits integer NOT NULL,
  price_inr numeric NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Packages visible to all"
  ON session_packages FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manages packages"
  ON session_packages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'owner_admin'
  ));

-- Seed the four packs
INSERT INTO session_packages (name, description, credits, price_inr, sort_order) VALUES
  ('Ek Swar', 'Try two sessions — a gentle beginning', 2, 1699, 1),
  ('Char Prahar', 'Four sessions across the day''s four prahars', 4, 3299, 2),
  ('Ashtadhatu', 'Eight sessions — one full month of practice', 8, 6399, 3),
  ('Maas Sadhana', 'Twelve sessions — committed sadhana', 12, 9199, 4);
```

### Migration 005 — student_credits
```sql
CREATE TABLE student_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  credits_balance integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own credits"
  ON student_credits FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admin sees all credits"
  ON student_credits FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
```

### Migration 006 — credit_transactions
```sql
CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'debit', 'refund')),
  credits integer NOT NULL,
  package_id uuid REFERENCES session_packages(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  booking_id uuid,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own transactions"
  ON credit_transactions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Admin sees all transactions"
  ON credit_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
```

### Migration 007 — bookings
```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  requested_at timestamptz DEFAULT now(),
  scheduled_at timestamptz,
  duration_minutes integer DEFAULT 60,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  daily_room_name text,
  daily_room_url text,
  student_join_url text,
  teacher_join_url text,
  notes_to_teacher text,
  credits_deducted integer DEFAULT 1,
  cancelled_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own bookings"
  ON bookings FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see their bookings"
  ON bookings FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin sees all bookings"
  ON bookings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));

CREATE POLICY "Students can create bookings"
  ON bookings FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can update booking status"
  ON bookings FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );
```

### Migration 008 — assignments
```sql
CREATE TABLE assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  student_id uuid NOT NULL REFERENCES profiles(id),
  title text NOT NULL,
  description text,
  deliverables text[] DEFAULT '{}',
  due_before timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own assignments"
  ON assignments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers see assignments they created"
  ON assignments FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers create assignments"
  ON assignments FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );
```

### Migration 009 — submissions
```sql
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reviewed')),
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own submissions"
  ON submissions FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create submissions"
  ON submissions FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers see submissions for their assignments"
  ON submissions FOR SELECT
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Teachers update submission status"
  ON submissions FOR UPDATE
  USING (
    assignment_id IN (
      SELECT id FROM assignments WHERE teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );
```

### Migration 010 — submission_files
```sql
CREATE TABLE submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'pdf', 'image', 'text')),
  file_url text NOT NULL,
  file_key text NOT NULL,
  file_name text NOT NULL,
  file_size_kb integer,
  label text,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submission files visible to student and teacher"
  ON submission_files FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
    OR
    submission_id IN (
      SELECT s.id FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE a.teacher_id IN (
        SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students upload their own files"
  ON submission_files FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM submissions WHERE student_id = auth.uid()
    )
  );
```

### Migration 011 — feedback
```sql
CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  feedback_text text,
  feedback_audio_url text,
  feedback_audio_key text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback visible to student and teacher"
  ON feedback FOR SELECT
  USING (
    submission_id IN (
      SELECT s.id FROM submissions s WHERE s.student_id = auth.uid()
    )
    OR
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Teachers post feedback"
  ON feedback FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );
```

### Migration 012 — payouts
```sql
CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teacher_profiles(id),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  gross_amount numeric NOT NULL,
  platform_cut numeric NOT NULL,
  teacher_amount numeric NOT NULL,
  is_owner_session boolean DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid')),
  paid_at timestamptz,
  payment_reference text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own payouts"
  ON payouts FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM teacher_profiles WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin manages all payouts"
  ON payouts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner_admin'
  ));
```

### Migration 013 — triggers
```sql
-- Auto-create student_credits row on profile creation
CREATE OR REPLACE FUNCTION create_student_credits()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' THEN
    INSERT INTO student_credits (student_id, credits_balance)
    VALUES (NEW.id, 0)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
AFTER INSERT ON profiles
FOR EACH ROW EXECUTE FUNCTION create_student_credits();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teacher_profiles_updated_at
BEFORE UPDATE ON teacher_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Migration 014 — Amee seed
```sql
-- Run AFTER Amee registers via the auth UI.
-- Replace the UUID below with Amee's actual auth.users id.

-- UPDATE profiles
-- SET role = 'owner_admin', is_owner = true
-- WHERE email = 'amee@naadvidya.in';

-- REMINDER: Uncomment and run this only after Amee signs up.
```

---

## FILE & FOLDER STRUCTURE

```
naadvidya/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    ← Hero / home
│   │   ├── teachers/
│   │   │   ├── page.tsx                ← Browse teachers
│   │   │   └── [slug]/page.tsx         ← Teacher profile
│   │   └── layout.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (student)/
│   │   ├── dashboard/page.tsx          ← Student home
│   │   ├── credits/page.tsx            ← Buy credits
│   │   ├── book/[teacherId]/page.tsx   ← Book a session
│   │   ├── session/[bookingId]/page.tsx ← Live video room
│   │   └── homework/
│   │       ├── page.tsx                ← Assignment inbox
│   │       └── [assignmentId]/page.tsx ← Submit homework
│   ├── (teacher)/
│   │   ├── dashboard/page.tsx          ← Teacher home
│   │   ├── profile/page.tsx            ← Edit profile + availability
│   │   ├── earnings/page.tsx
│   │   └── homework/
│   │       ├── page.tsx                ← All pending submissions
│   │       └── [submissionId]/page.tsx ← Review + post feedback
│   ├── (admin)/
│   │   ├── dashboard/page.tsx          ← Amee's control panel
│   │   ├── teachers/page.tsx           ← Approval queue
│   │   ├── bookings/page.tsx
│   │   ├── students/page.tsx
│   │   └── payouts/page.tsx
│   └── api/
│       ├── auth/callback/route.ts
│       ├── bookings/
│       │   ├── create/route.ts
│       │   └── confirm/route.ts        ← Creates Daily.co room
│       ├── daily/
│       │   └── token/route.ts          ← Meeting token for video
│       ├── payments/
│       │   ├── create-order/route.ts   ← Razorpay order
│       │   └── webhook/route.ts        ← Razorpay webhook → credits
│       ├── upload/
│       │   └── presign/route.ts        ← R2 presigned upload URL
│       └── teachers/
│           └── approve/route.ts        ← Admin approval
├── components/
│   ├── ui/                             ← Shared UI primitives
│   ├── nav/
│   ├── hero/
│   ├── teacher-card/
│   ├── video-room/                     ← Daily.co iframe component
│   ├── assignment-form/
│   ├── submission-form/
│   └── feedback-form/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── daily.ts                        ← Daily.co API helpers
│   ├── razorpay.ts                     ← Payment helpers
│   ├── r2.ts                           ← Cloudflare R2 helpers
│   ├── resend.ts                       ← Email helpers
│   └── utils.ts
├── middleware.ts                        ← Route protection by role
└── emails/                             ← React Email templates
    ├── booking-confirmed.tsx
    ├── assignment-posted.tsx
    └── feedback-received.tsx
```

---

## KEY API INTEGRATIONS

### Daily.co — Video Room Creation
```typescript
// lib/daily.ts

// Called when teacher CONFIRMS a booking
export async function createDailyRoom(bookingId: string) {
  const roomName = `naadvidya-${bookingId}`;

  const res = await fetch(`${process.env.DAILY_API_BASE}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        enable_chat: true,
        enable_screenshare: false,
        max_participants: 2,
        exp: Math.floor(Date.now() / 1000) + 7200, // expires 2 hours from creation
      },
    }),
  });

  const room = await res.json();
  return room;
}

// Generate meeting token (student = non-owner, teacher = owner/moderator)
export async function createMeetingToken(roomName: string, isTeacher: boolean, participantName: string) {
  const res = await fetch(`${process.env.DAILY_API_BASE}/meeting-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        is_owner: isTeacher,
        user_name: participantName,
        exp: Math.floor(Date.now() / 1000) + 7200,
      },
    }),
  });

  const { token } = await res.json();
  return token;
}
```

### Video Room Component
```typescript
// components/video-room/VideoRoom.tsx
'use client';
import { useEffect, useRef } from 'react';

interface VideoRoomProps {
  roomUrl: string;
  token: string;
}

export function VideoRoom({ roomUrl, token }: VideoRoomProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Daily.co iframe embed — no SDK needed for Phase 1
  const src = `${roomUrl}?t=${token}`;

  return (
    <iframe
      ref={frameRef}
      src={src}
      allow="camera; microphone; fullscreen; display-capture"
      style={{ width: '100%', height: '600px', border: 'none', borderRadius: '8px' }}
      title="Naadvidya Session Room"
    />
  );
}
```

### Razorpay — Payment Flow
```typescript
// app/api/payments/create-order/route.ts
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  const { packageId, studentId } = await req.json();

  // Fetch package price from DB
  const supabase = createServerClient();
  const { data: pkg } = await supabase
    .from('session_packages')
    .select('*')
    .eq('id', packageId)
    .single();

  const order = await razorpay.orders.create({
    amount: Math.round(pkg.price_inr * 100), // paise
    currency: 'INR',
    receipt: `naadvidya_${Date.now()}`,
    notes: { packageId, studentId },
  });

  return Response.json({ orderId: order.id, amount: order.amount });
}

// app/api/payments/webhook/route.ts
// Verify Razorpay signature → add credits → log transaction
// IMPORTANT: Verify signature with crypto.createHmac before touching DB
```

### Cloudflare R2 — File Upload
```typescript
// lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Generate presigned upload URL (expires in 5 minutes)
export async function getUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(r2, command, { expiresIn: 300 });
}

// File key convention: submissions/{submissionId}/{timestamp}-{label}
// e.g.: submissions/abc-123/1748600000-yaman-recording.mp3
```

---

## BOOKING FLOW — EXACT SEQUENCE

```
1. Student clicks "Request Session" on teacher profile
   → Choose available slot from teacher_availability
   → Credits checked (must have ≥ 1)
   → POST /api/bookings/create
     → Deduct 1 credit from student_credits
     → Create credit_transaction (type: 'debit')
     → Create booking (status: 'pending')
     → Email teacher: "New session request from [Student Name]"

2. Teacher sees request in dashboard
   → Clicks "Confirm"
   → POST /api/bookings/confirm
     → Call createDailyRoom(bookingId)
     → Store room name, student join URL, teacher join URL in bookings
     → Update booking status → 'confirmed'
     → Email student: "Session confirmed — [Date/Time]" with join link
     → Create payout record (status: 'pending')

3. At session time — both click their join link
   → app/session/[bookingId]/page.tsx
   → Server generates fresh Daily.co token for each participant
   → VideoRoom component renders iframe

4. After session — teacher clicks "Session Complete"
   → booking status → 'completed'
   → Teacher creates assignment (optional but encouraged)
   → Payout status remains 'pending' (Amee pays manually)
```

---

## PAYOUT CALCULATION RULE

```typescript
// When creating a payout record on booking completion:

const isOwnerSession = await checkIfOwner(teacherProfileId);

const grossAmount = sessionFeeInr;
const platformCut = isOwnerSession ? 0 : grossAmount * 0.20;
const teacherAmount = isOwnerSession ? grossAmount : grossAmount * 0.80;

// Insert into payouts table with is_owner_session flag
```

---

## MIDDLEWARE — ROUTE PROTECTION

```typescript
// middleware.ts
// Protect routes by role:
// /dashboard → student only
// /teacher/* → teacher or owner_admin
// /admin/* → owner_admin only

// Use Supabase server-side session check
// Redirect unauthorized users to /login with returnUrl
```

---

## DESIGN TOKENS — USE THROUGHOUT

```css
/* globals.css */
:root {
  --maroon:       #2D0808;
  --maroon-mid:   #8B1A1A;
  --gold:         #C5A028;
  --saffron:      #E07B39;
  --parchment:    #FAF3E0;
  --ink:          #1A0A00;
  --muted:        #7A6652;

  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
}
```

Load via Google Fonts in `app/layout.tsx`:
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
```

---

## ADMIN DASHBOARD — AMEE'S CONTROLS

Build `/admin/dashboard` with these panels:

1. **Teacher approval queue** — Table of pending teachers with Approve / Reject buttons. Rejecting requires a note (stored in `rejection_note`). Approving sets `approval_status = 'approved'` and `is_visible = true`.

2. **Booking overview** — Today's sessions, upcoming 7 days, past sessions. Filter by teacher. Status badges.

3. **Revenue summary** — This month: gross, platform 20%, total teacher payouts due. Simple numbers, no charts needed in Phase 1.

4. **Payout tracker** — Table of pending payouts per teacher. "Mark Paid" button updates status to 'paid' and records reference.

5. **Student list** — Name, email, credits balance, session count.

---

## TEACHER DASHBOARD — KEY SCREENS

1. **Profile editor** — All `teacher_profiles` fields. Availability slots (add/remove day+time). "Profile pending approval" banner if `approval_status = 'pending'`.

2. **Upcoming sessions** — Next 7 days. Join button appears 15 minutes before scheduled time.

3. **Homework inbox** — All submissions awaiting review. Badge count. Each row: student name, assignment title, submitted date, file count.

4. **Assignment creator** — Post-session. Fields: title, description, deliverables (array — add/remove chips), due date. Linked to a completed booking.

5. **Earnings** — Total earned this month, total all-time, pending payout amount.

---

## STUDENT DASHBOARD — KEY SCREENS

1. **Upcoming sessions** — With join link and countdown.

2. **Credit balance** — Large number. "Buy More" CTA → /credits page with 4 pack options and Razorpay checkout.

3. **Assignment inbox** — Pending submissions. Overdue highlighted.

4. **Submission screen** — For each deliverable in the assignment: upload audio (voice recording), upload PDF/image (notes). Each file tagged with deliverable label. "Submit All" button.

5. **Past sessions + feedback** — History of completed sessions with teacher feedback.

---

## BUILD ORDER (Phase 1)

Follow this sequence. Do not jump ahead.

```
STEP 1: Project init
  → npx create-next-app@14 naadvidya --typescript --tailwind --app
  → Install: @supabase/supabase-js @supabase/ssr
  → Install: razorpay @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  → Install: resend react-email
  → Set up .env.local

STEP 2: Supabase setup
  → Run all 14 migrations in order
  → Confirm all tables exist in Supabase dashboard
  → Set up lib/supabase/client.ts and server.ts
  → Set up middleware.ts with auth check

STEP 3: Auth
  → /login page (email + password via Supabase Auth)
  → /register page (name, email, password, role: student or teacher)
  → On register: create profile row with correct role
  → Auth callback handler
  → Test: register student, register teacher, login, check profiles table

STEP 4: Public pages
  → Hero page (/) — use the design already shown to client
  → /teachers — grid of approved teachers
  → /teachers/[slug] — full profile, availability, "Request Session" CTA

STEP 5: Credit purchase
  → /credits page — 4 packs displayed
  → Razorpay checkout integration
  → Webhook → credits added to student_credits
  → Verify with test payment

STEP 6: Booking flow
  → /book/[teacherId] — slot selection from availability
  → POST /api/bookings/create — deduct credit, create booking
  → Teacher dashboard — see pending bookings
  → POST /api/bookings/confirm — create Daily.co room
  → Confirmation emails via Resend

STEP 7: Video session
  → /session/[bookingId] — VideoRoom iframe
  → API route for Daily.co token generation
  → "Mark Complete" button for teacher
  → Payout record created on complete

STEP 8: Homework loop
  → Teacher: assignment creator form
  → Student: submission screen with file upload
  → R2 presigned upload flow
  → Teacher: review screen + feedback form (text + optional audio note)
  → Email notifications at each step

STEP 9: Admin dashboard
  → Teacher approval queue
  → Booking overview
  → Payout tracker

STEP 10: Polish
  → Loading states on all async operations
  → Error boundaries
  → Mobile responsiveness
  → Empty states (no bookings yet, no assignments yet)
  → Confirm all RLS policies working as expected
```

---

## CRITICAL RULES

1. **Never skip RLS.** Every table has it enabled. Every policy is intentional. Test by logging in as each role and confirming what is and is not visible.

2. **is_owner = true means no 20% cut.** This boolean on Amee's profile is the single source of truth for payout calculation. Check it every time you compute a payout.

3. **Daily.co rooms expire.** Set `exp` to 2 hours after scheduled session time. Never create rooms more than 24 hours in advance — keep room creation in the confirm step only.

4. **Razorpay webhook must verify signature.** Never credit a student's account without cryptographic verification of the webhook payload. Use `crypto.createHmac('sha256', secret)`.

5. **R2 files are private.** Generate presigned URLs for display. Never store public URLs directly. File keys follow convention: `submissions/{submissionId}/{timestamp}-{label}.{ext}`

6. **Teacher visible only after Amee approves.** `is_visible = false` by default. The public `/teachers` page queries `WHERE is_visible = true`. A teacher with `approval_status = 'approved'` and `is_visible = false` should never happen — set both atomically in the approval API route.

7. **Session credit deducted at booking, not at session.** If a session is cancelled by the teacher, refund the credit. Add a refund `credit_transaction` row.

---

## PACKAGES TO INSTALL

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install razorpay
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install resend react-email @react-email/components
npm install date-fns
npm install @radix-ui/react-dialog @radix-ui/react-select
```

---

## WHAT IS NOT IN PHASE 1

Do not build these. They are Phase 2+.

- Stripe (international payments)
- Session recording archive
- Group masterclasses
- Grading rubrics / formal certificates
- Automated teacher payouts (manual via Amee in Phase 1)
- Mobile app (Expo)
- Carnatic vertical
- Rating / testimonial system

---

*Document: NAADVIDYA_CLAUDE_CODE_PROMPT.md v1.0*
*Companion to: NAADVIDYA_MASTER_SPEC.md v1.0*
*Created: May 2026 | Ready for Claude Code*
