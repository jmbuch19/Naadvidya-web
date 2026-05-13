# NAADVIDYA — Privacy Policy
## Version 1.0 | Last updated 2026-05-13

> LEGAL NOTE: This document is an honest first draft of how Naadvidya handles your data. It still requires review by a qualified Indian lawyer before final publication, particularly for full DPDP Act 2023 compliance. Do not treat as legal advice.

---

## 1. WHO WE ARE

Naadvidya is an online academy for Indian Classical music, operated by Mrs. Amee Buch, Sangeet Visharad. When this document says "we", "us", or "Naadvidya", it refers to the platform operator. You can reach us at **support@naadvidya.in** (general) or **amee@naadvidya.in** (privacy / sensitive matters).

The legal entity behind Naadvidya is **[to be confirmed before final publication]**, based in India.

---

## 2. WHAT THIS POLICY COVERS

This policy explains:
- What personal data we collect from students, teachers, and visitors
- Why we collect it and what we do with it
- Who we share it with (a small list of named processors)
- How long we keep it
- Your rights — including those under the **Digital Personal Data Protection Act 2023 (India)** and, for visitors in the EU/UK, the **GDPR**

It applies to **www.naadvidya.com** and **naadvidya.com**, and any mobile app or installable PWA built on top of the same platform.

---

## 3. WHAT WE COLLECT

### 3.1 If you create an account
- **Name and email address** (required) — to identify you and send platform notifications
- **Password** (stored hashed by our auth provider — never visible to us)
- **Role** — student, teacher, or owner
- **Timezone** — auto-detected on registration; you can change it
- **Phone / WhatsApp number** (optional) — only if you provide it for WhatsApp notifications

### 3.2 If you are a teacher
- **Profile information** — bio, qualifications, specialisations, ragas taught, languages, fee, intro video URL, optional avatar
- **Availability slots** — recurring weekly time windows you publish
- **Payout details** — UPI ID, OR bank account name + number + IFSC. **These are stored in a separate, access-restricted table that only you and the owner-admin can read.** Naadvidya staff do not browse them casually.
- **Voice Repo recordings** and accompanying notes (audio + optional PDF), with metadata you set (title, raga, taal, category, level)
- **Holiday dates** you mark off

### 3.3 If you are a student
- **Session credit balance** and an immutable ledger of every credit transaction (purchases, debits for bookings, refunds)
- **Bookings, enrolments, and scheduled sessions** linked to teachers you choose
- **Homework you upload** — voice recordings, notation PDFs, written notes
- **Razorpay transaction IDs** for credit-pack purchases (we never see your card details — Razorpay handles them)

### 3.4 During a live session
- The video room is hosted by **Daily.co**. Naadvidya itself does not record sessions. If a session is mutually consented to be recorded (Phase 2), the file is stored privately in the student's folder.

### 3.5 Automatically, when you use the site
- **Standard server logs** (timestamps, IP address, user agent) — used for debugging and security; rotated within 30 days
- **Authentication session cookies** — strictly necessary to keep you logged in
- **Service worker / PWA caches** — stored locally in your browser to make the app fast and partially offline-tolerant

We do **not** run third-party advertising trackers, behavioural-profile cookies, or session-replay tools. Naadvidya is ad-free.

---

## 4. WHY WE COLLECT IT

| Purpose | Data used | Lawful basis (GDPR) |
|---|---|---|
| Run your account and the service | Name, email, password (hashed), role | Contract |
| Process credit purchases and payouts | Razorpay txn IDs, payout details (teachers) | Contract |
| Send transactional notifications (booking confirmed, homework posted, reminders) | Email; optional phone for WhatsApp | Contract / consent |
| Operate video sessions | Name (passed to Daily.co room as a display name) | Contract |
| Curate the platform (Amee reviews teacher applications & offerings) | Profile info you submit | Legitimate interests |
| Protect the platform from abuse | Server logs | Legitimate interests |
| Comply with Indian tax / payment law | Payout records, GST data if applicable | Legal obligation |

---

## 5. WHO WE SHARE IT WITH

We share the minimum needed, with named processors only. We do **not** sell your data, ever.

| Processor | Role | What they see |
|---|---|---|
| **Supabase** (Postgres + Auth, hosted in Mumbai region) | Primary database and authentication | All structured data — accounts, profiles, bookings, enrolments, credits, payouts, etc. |
| **Cloudflare R2** | File storage (private buckets) | Homework files, audio feedback, Voice Repo recordings — served only via short-lived presigned URLs |
| **Daily.co** | Live video rooms | Your display name during a session; participant connection metadata |
| **Razorpay** | Payment processing (credit-pack purchases) | Email, transaction amount and order ID. Card / UPI authentication happens on Razorpay's domain; we never see card numbers |
| **Resend** | Transactional email | Your email address and the email content sent to you |
| **Meta (WhatsApp Business API)** | Transactional WhatsApp messages (only if you opt in and provide a number) | Your name, phone number, and the template parameters in each message |
| **Vercel** | Web hosting and serverless functions | Standard request logs |

Within Naadvidya, only the owner-admin (Amee Buch) has access to platform-wide data. Teachers see only their own students; students see only their own data. Row-Level Security in the database enforces this.

---

## 6. WHERE YOUR DATA LIVES

- Database (Supabase): **Mumbai (ap-south-1)**
- File storage (Cloudflare R2): global; cached close to you when served
- Hosting (Vercel): functions run in **Mumbai (bom1)**
- Email (Resend): EU / US infrastructure
- WhatsApp (Meta): per Meta's stated regions

For users in the EU/UK, data may transit to/be processed in India and the US — by using the platform you understand this transfer is necessary to provide the service.

---

## 7. HOW LONG WE KEEP IT

| Data | Retention |
|---|---|
| Account profile + credentials | While your account is active. Inactive ≥ 12 months → we email you 30 days' notice before any deletion (cancellation policy §7) |
| Credit-transaction ledger | 7 years (tax / dispute resolution) |
| Homework files, audio feedback | While your account is active. You can download your own files at any time and request deletion |
| Voice Repo recordings | Until the teacher deletes them or their account is closed |
| Server logs | 30 days |
| Session recordings (Phase 2, only if both parties consent) | In the student's folder, until they delete |

---

## 8. YOUR RIGHTS

Under DPDP Act 2023 and (where applicable) GDPR, you have the right to:

- **Access** the personal data we hold about you
- **Correct** any inaccurate or incomplete data
- **Delete** your account and your associated data ("right to be forgotten" / DPDP "right to erasure"). We provide a self-service deletion in your profile, or you can email **amee@naadvidya.in**
- **Port** your data — receive an export of your data in a portable format
- **Withdraw consent** for optional channels (e.g. WhatsApp) at any time. Transactional emails tied to the service contract cannot be opted out of while you have an active account
- **Object** to specific processing — write to us
- **Lodge a complaint** with the Data Protection Board of India (or your local data-protection authority, for EU/UK residents)

**Children:** Naadvidya is intended for users aged 13 and above. If you are a minor (under 18 in India), a parent or guardian must register and supervise. We do not knowingly collect data from children under 13.

---

## 9. COOKIES & LOCAL STORAGE

We use a small number of strictly-necessary cookies:

- **Session cookie** (`sb-*`) — keeps you logged in. Set by our auth provider (Supabase). HttpOnly, Secure.
- **CSRF / state cookies** — for OAuth callback and auth flow safety.

Local storage / service-worker cache stores the app shell and your audio-pluginsettings (Tanpura tonic, Taal Timer BPM) so the practice tools work offline. None of this is sent to a server.

We do **not** use third-party analytics cookies (no Google Analytics, no Meta Pixel, no behaviour trackers). If we ever add analytics, we will update this policy and ask for explicit consent.

---

## 10. SECURITY

- All traffic is over HTTPS / TLS
- Passwords are never stored in plain text (auth provider handles hashing)
- Database access is gated by Row-Level Security policies; teachers can only see their own students' submissions, students only their own bookings, etc.
- File downloads are served via short-lived presigned URLs — no public-bucket links
- Payment card details never touch our servers (Razorpay-hosted checkout)

No system is perfectly secure. If you become aware of a vulnerability, please email **amee@naadvidya.in** with the details — we'll respond within 5 business days.

---

## 11. CHANGES TO THIS POLICY

We may update this policy as the platform evolves or as the law requires. Material changes will be notified by email to all active users at least 14 days before they take effect. The current version and last-updated date are always shown at the top of this page.

---

## 12. CONTACT

- **General privacy queries:** privacy@naadvidya.in
- **Account deletion / data export:** amee@naadvidya.in
- **Security disclosures:** amee@naadvidya.in
- **Operator:** Mrs. Amee Buch, Sangeet Visharad — [legal entity to be confirmed]

---

*This policy is published as a draft pending qualified legal review. Last updated 2026-05-13.*
