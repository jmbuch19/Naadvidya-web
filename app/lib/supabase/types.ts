// Hand-written Supabase Database types matching app/supabase/migrations/*.
// Once the Supabase project is provisioned, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
// and the auto-generated version supersedes this one.

export type Role = 'owner_admin' | 'teacher' | 'student';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type CreditTxnType = 'purchase' | 'debit' | 'refund' | 'goodwill';
export type SubmissionStatus = 'draft' | 'submitted' | 'reviewed';
export type FileType = 'audio' | 'pdf' | 'image' | 'text';
export type PayoutStatus = 'pending' | 'paid' | 'held';

// --- Row shapes (post-insert, as returned from SELECT) ---

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: Role;
  is_owner: boolean;
  phone: string | null;
  city: string | null;
  country: string;
  timezone: string;
  whatsapp_number: string | null;
  whatsapp_opted_in: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeacherProfileRow {
  id: string;
  profile_id: string;
  bio: string | null;
  years_experience: number;
  sangeet_qualifications: string[];
  specializations: string[];
  ragas_taught: string[];
  languages: string[];
  gharana: string | null;
  gurus: string[];
  instruments: string[];
  student_levels: string[];
  session_fee_inr: number;
  intro_video_url: string | null;
  approval_status: ApprovalStatus;
  rejection_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  is_visible: boolean;
  auto_confirm: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherAvailabilityRow {
  id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface SessionPackageRow {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price_inr: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface StudentCreditsRow {
  id: string;
  student_id: string;
  credits_balance: number;
  updated_at: string;
}

export interface CreditTransactionRow {
  id: string;
  student_id: string;
  type: CreditTxnType;
  credits: number;
  package_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  booking_id: string | null;
  note: string | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  student_id: string;
  teacher_id: string;
  requested_at: string;
  scheduled_at: string | null;
  duration_minutes: number;
  is_trial: boolean;
  status: BookingStatus;
  daily_room_name: string | null;
  daily_room_url: string | null;
  student_join_url: string | null;
  teacher_join_url: string | null;
  notes_to_teacher: string | null;
  credits_deducted: number;
  cancelled_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentRow {
  id: string;
  booking_id: string | null;
  teacher_id: string;
  student_id: string;
  title: string;
  description: string | null;
  deliverables: string[];
  due_before: string | null;
  created_at: string;
}

export interface SubmissionRow {
  id: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
}

export interface SubmissionFileRow {
  id: string;
  submission_id: string;
  file_type: FileType;
  file_url: string;
  file_key: string;
  file_name: string;
  file_size_kb: number | null;
  label: string | null;
  uploaded_at: string;
}

export interface FeedbackRow {
  id: string;
  submission_id: string;
  teacher_id: string;
  feedback_text: string | null;
  feedback_audio_url: string | null;
  feedback_audio_key: string | null;
  created_at: string;
}

export interface PayoutRow {
  id: string;
  teacher_id: string;
  booking_id: string;
  gross_amount: number;
  platform_cut: number;
  teacher_amount: number;
  is_owner_session: boolean;
  status: PayoutStatus;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
}

// --- Supabase Database type ---
// Insert/Update use Partial<Row> for simplicity. Required-on-insert fields are
// enforced by NOT NULL columns at the DB layer; TS will still accept them as
// optional, which matches the runtime behaviour fine for our needs.

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow> & { id: string; full_name: string; email: string; role: Role }; Update: Partial<ProfileRow> };
      teacher_profiles: { Row: TeacherProfileRow; Insert: Partial<TeacherProfileRow> & { profile_id: string }; Update: Partial<TeacherProfileRow> };
      teacher_availability: { Row: TeacherAvailabilityRow; Insert: Partial<TeacherAvailabilityRow> & { teacher_id: string; day_of_week: number; start_time: string; end_time: string }; Update: Partial<TeacherAvailabilityRow> };
      session_packages: { Row: SessionPackageRow; Insert: Partial<SessionPackageRow> & { name: string; credits: number; price_inr: number }; Update: Partial<SessionPackageRow> };
      student_credits: { Row: StudentCreditsRow; Insert: { student_id: string; credits_balance?: number }; Update: Partial<StudentCreditsRow> };
      credit_transactions: { Row: CreditTransactionRow; Insert: Partial<CreditTransactionRow> & { student_id: string; type: CreditTxnType; credits: number }; Update: Partial<CreditTransactionRow> };
      bookings: { Row: BookingRow; Insert: Partial<BookingRow> & { student_id: string; teacher_id: string }; Update: Partial<BookingRow> };
      assignments: { Row: AssignmentRow; Insert: Partial<AssignmentRow> & { teacher_id: string; student_id: string; title: string }; Update: Partial<AssignmentRow> };
      submissions: { Row: SubmissionRow; Insert: Partial<SubmissionRow> & { assignment_id: string; student_id: string }; Update: Partial<SubmissionRow> };
      submission_files: { Row: SubmissionFileRow; Insert: Partial<SubmissionFileRow> & { submission_id: string; file_type: FileType; file_url: string; file_key: string; file_name: string }; Update: Partial<SubmissionFileRow> };
      feedback: { Row: FeedbackRow; Insert: Partial<FeedbackRow> & { submission_id: string; teacher_id: string }; Update: Partial<FeedbackRow> };
      payouts: { Row: PayoutRow; Insert: Partial<PayoutRow> & { teacher_id: string; booking_id: string; gross_amount: number; platform_cut: number; teacher_amount: number }; Update: Partial<PayoutRow> };
    };
    Views: Record<string, never>;
    Functions: {
      apply_credit_change: {
        Args: {
          p_student_id: string;
          p_type: CreditTxnType;
          p_credits: number;
          p_package_id?: string;
          p_razorpay_order_id?: string;
          p_razorpay_payment_id?: string;
          p_booking_id?: string;
          p_note?: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
