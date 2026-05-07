// bal24 v2 — 교육생 신청 + 강사·TA 모집 타입 (STEP 11 옵션 B 신규)

export type ParticipantStatus =
  | 'applied'
  | 'reviewing'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'completed';

export interface ParticipantApplication {
  id: string;
  program_id: string;
  name: string;
  phone: string;
  email: string | null;
  birth_year: string | null;
  id_number_masked: string | null;
  gender: 'male' | 'female' | 'other' | null;
  address: string | null;
  organization: string | null;
  motivation: string | null;
  experience: string | null;
  privacy_agreed: boolean;
  privacy_agreed_at: string | null;
  status: ParticipantStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  attendance_rate: number | null;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type RecruitType = 'instructor' | 'ta' | 'expert' | 'mentor';

export const RECRUIT_TYPE_LABEL: Record<RecruitType, string> = {
  instructor: '강사',
  ta: 'TA',
  expert: '전문가',
  mentor: '멘토',
};

export interface RecruitForm {
  id: string;
  program_id: string;
  recruit_type: RecruitType;
  title: string;
  description: string | null;
  requirements: string | null;
  benefits: string | null;
  deadline: string | null;
  max_count: number | null;
  form_token: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RecruitApplicationStatus = 'applied' | 'reviewing' | 'accepted' | 'rejected';

export interface RecruitApplication {
  id: string;
  form_id: string;
  name: string;
  phone: string;
  email: string | null;
  career: string | null;
  portfolio_url: string | null;
  attachment_urls: string[] | null;
  specialty: string[] | null;
  available_dates: string | null;
  message: string | null;
  privacy_agreed: boolean;
  privacy_agreed_at: string | null;
  status: RecruitApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}
