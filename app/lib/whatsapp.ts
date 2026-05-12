// lib/whatsapp.ts
// Naadvidya — WhatsApp Business API (Meta Cloud API)
// Uses existing EdUsaathiAI Meta Business account
// 28 templates — all UTILITY category

// ============================================================
// CORE SENDER
// ============================================================

async function sendTemplate(
  to: string,
  templateName: string,
  params: string[],
  buttonUrl?: string
) {
  if (!process.env.META_WHATSAPP_TOKEN || !process.env.META_WHATSAPP_PHONE_NUMBER_ID) {
    console.warn(`[WhatsApp] Not configured — skipping: ${templateName}`);
    return null;
  }

  const number = to.replace(/\D/g, '');
  const e164 = number.startsWith('91') ? `+${number}` : `+91${number}`;

  const components: object[] = [
    {
      type: 'body',
      parameters: params.map(p => ({ type: 'text', text: p })),
    },
  ];

  if (buttonUrl) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: buttonUrl }],
    });
  }

  try {
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
          to: e164,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components,
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) console.error(`[WhatsApp] Error for ${templateName}:`, data);
    return data;
  } catch (err) {
    console.error(`[WhatsApp] Network error for ${templateName}:`, err);
    return null;
  }
}

// Guard: only send if student/teacher has opted in
function canSend(whatsappNumber?: string | null, optedIn?: boolean | null): boolean {
  return !!(whatsappNumber && optedIn);
}

// ============================================================
// STUDENT NOTIFICATIONS
// ============================================================

// Template 1 — booking_confirmed
export async function waBookingConfirmed(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  date: string;         // "Tuesday, 17 June 2026"
  time: string;         // "7:00 PM"
  timezone: string;     // "IST" or "BST" etc.
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_booking_confirmed', [
    opts.studentName, opts.teacherName, opts.date, opts.time, opts.timezone,
  ]);
}

// Template 2 — session_reminder_24hr (student)
export async function waStudentReminder24hr(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  date: string;
  time: string;
  timezone: string;
  homeworkStatus: 'submitted' | 'not_submitted';
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  const hw = opts.homeworkStatus === 'submitted'
    ? '✅ Homework submitted — you\'re ready!'
    : '⚠️ Homework not yet submitted. Upload before your session.';
  return sendTemplate(opts.to, 'naadvidya_session_reminder_24hr', [
    opts.studentName, opts.teacherName, opts.date, opts.time, opts.timezone, hw,
  ]);
}

// Template 3 — session_reminder_1hr (student)
export async function waStudentReminder1hr(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  time: string;
  timezone: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_session_reminder_1hr', [
    opts.studentName, opts.teacherName, opts.time, opts.timezone,
  ]);
}

// Template 4 — session_starting_now (student)
export async function waSessionStartingNow(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_session_starting_now', [
    opts.studentName, opts.teacherName,
  ]);
}

// Template 5 — assignment_posted
export async function waAssignmentPosted(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  assignmentTitle: string;
  dueDate: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_assignment_posted', [
    opts.studentName, opts.teacherName, opts.assignmentTitle, opts.dueDate,
  ]);
}

// Template 6 — feedback_received
export async function waFeedbackReceived(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  assignmentTitle: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_feedback_received', [
    opts.studentName, opts.teacherName, opts.assignmentTitle,
  ]);
}

// Template 7 — homework_due_tomorrow
export async function waHomeworkDueTomorrow(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  assignmentTitle: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_homework_due_tomorrow', [
    opts.studentName, opts.teacherName, opts.assignmentTitle,
  ]);
}

// Template 8 — booking_cancelled_teacher
export async function waBookingCancelledByTeacher(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  date: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_booking_cancelled_teacher', [
    opts.studentName, opts.teacherName, opts.date,
  ]);
}

// Template 9 — session_rescheduled (student)
export async function waSessionRescheduled(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  newDate: string;
  newTime: string;
  timezone: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_session_rescheduled', [
    opts.studentName, opts.teacherName, opts.newDate, opts.newTime, opts.timezone,
  ]);
}

// Template 10 — low_credits_warning
export async function waLowCreditsWarning(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  teacherName: string;
  nextSessionDate: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_low_credits_warning', [
    opts.studentName, opts.teacherName, opts.nextSessionDate,
  ]);
}

// Template 11 — goodwill_credit_added
export async function waGoodwillCreditAdded(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  newBalance: number;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_goodwill_credit_added', [
    opts.studentName, String(opts.newBalance),
  ]);
}

// Template 12 — credit_purchase_confirmed
export async function waCreditPurchaseConfirmed(opts: {
  to: string; optedIn: boolean;
  studentName: string;
  creditsAdded: number;
  packName: string;
  amountPaid: number;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_credit_purchase_confirmed', [
    opts.studentName,
    String(opts.creditsAdded),
    opts.packName,
    String(opts.amountPaid),
  ]);
}

// ============================================================
// TEACHER NOTIFICATIONS
// ============================================================

// Template 13 — teacher_approved
export async function waTeacherApproved(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_teacher_approved', [opts.teacherName]);
}

// Template 14 — new_booking_request
export async function waNewBookingRequest(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  studentName: string;
  requestedDate: string;
  requestedTime: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_new_booking_request', [
    opts.teacherName, opts.studentName, opts.requestedDate, opts.requestedTime,
  ]);
}

// Template 15 — homework_submitted
export async function waHomeworkSubmitted(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  studentName: string;
  assignmentTitle: string;
  fileCount: number;
  nextSessionDate: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_homework_submitted', [
    opts.teacherName,
    opts.studentName,
    opts.assignmentTitle,
    String(opts.fileCount),
    opts.nextSessionDate,
  ]);
}

// Template 16 — teacher_session_reminder_1hr
export async function waTeacherReminder1hr(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  studentName: string;
  time: string;
  homeworkStatus: 'submitted' | 'not_submitted';
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  const hw = opts.homeworkStatus === 'submitted' ? '✅ Submitted' : '❌ Not submitted';
  return sendTemplate(opts.to, 'naadvidya_teacher_session_reminder_1hr', [
    opts.teacherName, opts.studentName, opts.time, hw,
  ]);
}

// Template 17 — teacher_session_reminder_24hr
export async function waTeacherReminder24hr(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  time: string;
  date: string;
  studentName: string;
  homeworkStatus: 'submitted' | 'not_submitted';
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  const hw = opts.homeworkStatus === 'submitted' ? '✅ Submitted' : '❌ Not submitted';
  return sendTemplate(opts.to, 'naadvidya_teacher_session_reminder_24hr', [
    opts.teacherName, opts.time, opts.date, opts.studentName, hw,
  ]);
}

// Template 18 — student_cancelled
export async function waStudentCancelled(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  studentName: string;
  date: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_student_cancelled', [
    opts.teacherName, opts.studentName, opts.date,
  ]);
}

// Template 19 — homework_review_overdue
export async function waHomeworkReviewOverdue(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  studentName: string;
  assignmentTitle: string;
  nextSessionDate: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_homework_review_overdue', [
    opts.teacherName, opts.studentName, opts.assignmentTitle, opts.nextSessionDate,
  ]);
}

// Template 20 — payout_processed
export async function waPayoutProcessed(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  amount: number;
  sessionCount: number;
  sentTo: string;       // "UPI: teacher@upi" or "Bank: ****1234"
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_payout_processed', [
    opts.teacherName,
    String(opts.amount),
    String(opts.sessionCount),
    opts.sentTo,
  ]);
}

// Template 21 — teacher_rejected
export async function waTeacherRejected(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  rejectionReason: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_teacher_rejected', [
    opts.teacherName, opts.rejectionReason,
  ]);
}

// Template 22 — payout_held
export async function waPayoutHeld(opts: {
  to: string; optedIn: boolean;
  teacherName: string;
  amount: number;
  sessionRef: string;
}) {
  if (!canSend(opts.to, opts.optedIn)) return;
  return sendTemplate(opts.to, 'naadvidya_payout_held', [
    opts.teacherName, String(opts.amount), opts.sessionRef,
  ]);
}

// ============================================================
// ADMIN (AMEE) NOTIFICATIONS
// ============================================================

// Template 23 — admin_new_teacher_application
export async function waAdminNewTeacherApplication(opts: {
  teacherName: string;
  qualifications: string;
  appliedDate: string;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_new_teacher_application',
    [opts.teacherName, opts.qualifications, opts.appliedDate]
  );
}

// Template 24 — admin_dispute_raised
export async function waAdminDisputeRaised(opts: {
  disputeType: string;
  raisedBy: string;
  sessionDate: string;
  filedAt: string;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_dispute_raised',
    [opts.disputeType, opts.raisedBy, opts.sessionDate, opts.filedAt]
  );
}

// Template 25 — admin_harassment_urgent
export async function waAdminHarassmentUrgent(opts: {
  reportedBy: string;
  against: string;
  sessionDate: string;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_harassment_urgent',
    [opts.reportedBy, opts.against, opts.sessionDate]
  );
}

// Template 26 — admin_payout_reminder
export async function waAdminPayoutReminder(opts: {
  teacherCount: number;
  totalAmount: number;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_payout_reminder',
    [String(opts.teacherCount), String(opts.totalAmount)]
  );
}

// Template 27 — admin_payment_failure
export async function waAdminPaymentFailure(opts: {
  orderId: string;
  issue: string;
  time: string;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_payment_failure',
    [opts.orderId, opts.issue, opts.time]
  );
}

// Template 28 — admin_teacher_no_show
export async function waAdminTeacherNoShow(opts: {
  teacherName: string;
  studentName: string;
  sessionDate: string;
}) {
  if (!process.env.ADMIN_WHATSAPP_NUMBER) return;
  return sendTemplate(
    process.env.ADMIN_WHATSAPP_NUMBER,
    'naadvidya_admin_teacher_no_show',
    [opts.teacherName, opts.studentName, opts.sessionDate]
  );
}

// ============================================================
// ADD TO .env.example
// ============================================================
// META_WHATSAPP_TOKEN=
// META_WHATSAPP_PHONE_NUMBER_ID=
// META_WHATSAPP_BUSINESS_ACCOUNT_ID=
// META_WEBHOOK_VERIFY_TOKEN=
// ADMIN_WHATSAPP_NUMBER=+91XXXXXXXXXX   ← Amee's personal WhatsApp
