# NAADVIDYA — Scheduling & Holiday Policy
## Version 1.0

---

## 1. SESSION SCHEDULING RULES

### 1.1 General
- All sessions are 60 minutes unless explicitly stated as 45 or 90 minutes in the offering
- Sessions cannot be shorter than 45 minutes. If a session runs short due to teacher error or early disconnect, it is treated as a partial session (see Section 3)
- Confirmed sessions appear in both student and teacher dashboards with a join link active 15 minutes before start time

### 1.2 Mehfil Session Scheduling
- Student requests a slot from teacher's published availability
- Teacher has 24 hours to confirm or propose an alternate slot
- If no response within 24 hours, booking automatically cancels and credit is returned
- Session is locked 6 hours before start time — no further changes

### 1.3 Riyaaz Workshop Scheduling (Phase 1.5)
- Teacher publishes all session dates at time of workshop creation
- Students see the full schedule before enrolling
- No individual session rescheduling within a workshop — the workshop block is fixed
- Teacher may cancel one session per workshop for an emergency (makeup session mandatory)

### 1.4 Gurukul Path Scheduling (Phase 1.5)
- On enrollment, teacher and student jointly agree recurring weekly day/time slots
- All sessions for the month are pre-scheduled on the 1st of each month
- Teacher must publish next month's schedule by the 25th of the current month
- Student may request one schedule change per month with 5-day advance notice
- Teacher may reschedule one session per month with 24-hour advance notice

---

## 2. RESCHEDULING RULES

### 2.1 Who can reschedule
- Students can request reschedule (one per month per teacher relationship)
- Teachers can initiate reschedule (one per month per student relationship)
- Amee can reschedule any session for platform or emergency reasons

### 2.2 Rescheduling process
1. Initiator raises reschedule request in dashboard with reason and proposed new time
2. Other party has 24 hours to accept or propose alternate
3. If agreed: session updated, Daily.co room URL regenerated, new confirmation emails sent
4. If not agreed within 24 hours: original session stands; no credit adjustment

### 2.3 Limits
- A session may only be rescheduled once. Rescheduled sessions cannot be rescheduled again.
- A session rescheduled to > 30 days from original date requires Amee's approval
- `reschedule_count` is tracked in `scheduled_sessions` table for audit

---

## 3. PARTIAL SESSIONS

| Scenario | Outcome |
|---|---|
| Session ends 10+ min early due to teacher disconnect | Teacher receives 80% of 80% (i.e. 64% of session fee). Student receives 0.5 goodwill credit |
| Session ends 10+ min early due to student disconnect | Normal payout. No credit refund |
| Session ends 10+ min early due to Daily.co technical failure | Full credit refund to student. Normal payout to teacher. Platform absorbs the loss |
| Session under 15 min total due to teacher no-show | Full refund + goodwill credit. Strike to teacher |

---

## 4. HOLIDAY POLICY

### 4.1 Teacher holiday marking
- Teachers must mark holidays in their dashboard at least **7 days in advance**
- Maximum **2 consecutive weeks** of holidays per quarter (13-week period)
- Maximum **6 individual holiday days** per month
- Holidays marked < 48 hours before a confirmed session are treated as a teacher cancellation (see Cancellation Policy)

### 4.2 Indian national holidays
The following dates are pre-marked as optional teacher holidays on the platform. Teachers are encouraged (not required) to take these off:

| Holiday | Approximate Date |
|---|---|
| Republic Day | 26 January |
| Holi | March (variable) |
| Ram Navami | March/April (variable) |
| Independence Day | 15 August |
| Janmashtami | August (variable) |
| Navratri/Dussehra | September/October (variable) |
| Diwali (3 days) | October/November (variable) |
| Guru Nanak Jayanti | November (variable) |
| Christmas | 25 December |

Teachers mark their own holidays — the platform does not automatically block these dates.

### 4.3 Student notification of teacher holidays
- When a teacher marks a holiday, all students with upcoming sessions on that date are notified by email immediately
- Sessions on holiday dates are flagged in the dashboard as "Teacher Holiday — Rescheduling Required"
- Student credits for affected sessions are held (not deducted) until a makeup session is confirmed

### 4.4 Makeup sessions
- Every holiday-affected confirmed session must be made up within 21 days
- Teacher proposes makeup date within 48 hours of marking the holiday
- If makeup is not offered within 48 hours, student may choose: (a) makeup at their convenience, or (b) credit refund

---

## 5. EMERGENCY & FORCE MAJEURE SCHEDULING

See UNEXPECTED_SCENARIOS_POLICY.md for complete coverage of:
- Natural disasters, civic unrest, power failures
- Platform infrastructure outages
- Teacher or student medical emergencies
- Internet or device failure during an active session
