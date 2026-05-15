// Shared validation for the reschedule proposal flow.
// Implements NAADVIDYA_SCHEDULING_HOLIDAY_POLICY §2.

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface ProposeValidationInput {
  currentScheduledAt: Date;
  proposedNewAt: Date;
  rescheduleCount: number;
  hasPendingProposal: boolean;
  now?: Date;
}

export type ValidationError = { code: string; message: string };

export function validatePropose(input: ProposeValidationInput): ValidationError | null {
  const now = input.now ?? new Date();

  if (Number.isNaN(input.proposedNewAt.getTime())) {
    return { code: 'invalid_time', message: 'Proposed new time is not a valid date.' };
  }

  if (input.hasPendingProposal) {
    return {
      code: 'already_pending',
      message: 'A reschedule proposal is already pending for this session. Wait for the other party to respond, or cancel it first.',
    };
  }

  if (input.rescheduleCount >= 1) {
    return {
      code: 'already_rescheduled',
      message: 'This session has already been rescheduled once. Per policy, sessions can only be rescheduled a single time.',
    };
  }

  const msUntilStart = input.currentScheduledAt.getTime() - now.getTime();
  if (msUntilStart < SIX_HOURS_MS) {
    return {
      code: 'lock_window',
      message: 'Sessions are locked from changes 6 hours before start time. Contact the other party to cancel instead.',
    };
  }

  const msUntilProposed = input.proposedNewAt.getTime() - now.getTime();
  if (msUntilProposed < TWENTY_FOUR_HOURS_MS) {
    return {
      code: 'too_soon',
      message: 'The proposed new time must be at least 24 hours from now, so the other party has time to respond.',
    };
  }

  const driftMs = input.proposedNewAt.getTime() - input.currentScheduledAt.getTime();
  if (Math.abs(driftMs) > THIRTY_DAYS_MS) {
    return {
      code: 'over_thirty_days',
      message: 'Rescheduling more than 30 days from the original time requires admin approval. Please contact support@naadvidya.com.',
    };
  }

  return null;
}

// "One reschedule per month per student-teacher relationship" — count reschedules
// initiated by THIS user against THIS counterpart in the last 30 days.
export function withinMonthlyLimit(recentRescheduleCount: number): ValidationError | null {
  if (recentRescheduleCount >= 1) {
    return {
      code: 'monthly_limit',
      message: 'You have already initiated one reschedule with this counterpart in the last 30 days. Per policy, only one per month is allowed.',
    };
  }
  return null;
}
