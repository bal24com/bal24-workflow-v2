// bal24 v2 — STEP-PARTNER-SIDEBAR 타입 정의
// PARTNER (참여사 담당자) 전용 프로필 + 담당 프로그램.

export type PartnerAssignmentRole = 'lead' | 'support';

export const PARTNER_ROLE_LABEL: Record<PartnerAssignmentRole, string> = {
  lead:    '주담당',
  support: '지원',
};

export const PARTNER_ROLE_COLOR: Record<PartnerAssignmentRole, string> = {
  lead:    'bg-violet-100 text-violet-700 border-violet-200',
  support: 'bg-slate-100 text-slate-600 border-slate-200',
};

export interface PartnerProgram {
  id: string;
  name: string;
  program_type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  /** program_assignments.role */
  assignment_role: PartnerAssignmentRole | null;
}

export interface PartnerProfileSummary {
  id: string;
  name: string;
  role: string | null;
  consortium_member_id: string | null;
  my_token: string | null;
}
