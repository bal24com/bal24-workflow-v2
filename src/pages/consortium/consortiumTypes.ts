// bal24 v2 — 컨소시엄 독립 홈 공통 타입·상수 (STEP-CON)

export const CONSORTIUM_STATUS = ['구성중', '진행', '완료', '해산'] as const;
export type ConsortiumStatus = typeof CONSORTIUM_STATUS[number];

export const MEMBER_TYPE = ['lead', 'co', 'sub', 'observer'] as const;
export type MemberType = typeof MEMBER_TYPE[number];

export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  lead: '주관',
  co: '공동수행',
  sub: '위탁',
  observer: '참관',
};

export const MEMBER_TYPE_STYLE: Record<MemberType, string> = {
  lead: 'bg-violet-100 text-violet-700 border-violet-200',
  co: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  sub: 'bg-orange-50 text-orange-700 border-orange-200',
  observer: 'bg-slate-100 text-slate-600 border-slate-300',
};

export const CONSORTIUM_LINK_TYPE = [
  'apply', 'invite', 'attend', 'certificate', 'portal', 'report', 'settlement',
] as const;
export type ConsortiumLinkType = typeof CONSORTIUM_LINK_TYPE[number];

export const LINK_TYPE_LABEL: Record<ConsortiumLinkType, string> = {
  apply: '교육생 신청',
  invite: '강사 초대',
  attend: '출석 체크',
  certificate: '수료증',
  portal: '참여사 포털',
  report: '결과보고서',
  settlement: '정산 확인',
};

export const PERM_LEVEL = ['none', 'read', 'write', 'manage'] as const;
export type PermLevel = typeof PERM_LEVEL[number];

export const PERM_LEVEL_LABEL: Record<PermLevel, string> = {
  none: '없음',
  read: '조회',
  write: '쓰기',
  manage: '관리',
};

export const STAFF_ROLE = ['instructor', 'ta', 'facilitator', 'mentor', 'coordinator'] as const;
export type StaffRole = typeof STAFF_ROLE[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  instructor: '강사',
  ta: 'TA',
  facilitator: '퍼실리테이터',
  mentor: '멘토',
  coordinator: '코디네이터',
};

// ─── 인터페이스 ──────────────────────────────────────

export interface ConsortiumMember {
  id: string;
  consortium_id: string;
  client_id: string;
  member_type: MemberType;
  task_share_pct: number;
  allocated_budget: number;
  spent_amount: number;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  portal_enabled: boolean;
  responsibilities: string | null;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; business_name: string | null } | null;
}

export interface ConsortiumLink {
  id: string;
  consortium_id: string;
  program_id: string | null;
  link_type: ConsortiumLinkType;
  token: string;
  url_path: string;
  label: string | null;
  is_active: boolean;
  expires_at: string | null;
  click_count: number;
  response_count: number;
  created_at: string;
}

export interface ConsortiumPortalPerm {
  id: string;
  consortium_id: string;
  member_id: string;
  perm_overview: PermLevel;
  perm_programs: PermLevel;
  perm_tasks: PermLevel;
  perm_finance: PermLevel;
  perm_staff: PermLevel;
  perm_links: PermLevel;
  is_active: boolean;
  consortium_members?: ConsortiumMember | null;
}

export interface ConsortiumStaff {
  id: string;
  consortium_id: string;
  expert_id: string;
  program_id: string | null;
  role: StaffRole;
  fee_type: string | null;
  confirmed: boolean;
  notes: string | null;
  created_at: string;
  staff_pool?: { id: string; name: string; specialty: string[] | null } | null;
  programs?: { id: string; name: string } | null;
}

export interface MemberBudget {
  clientId: string;
  clientName: string;
  memberType: MemberType;
  taskSharePct: number;
  allocatedBudget: number;
  spentAmount: number;
  remainingBudget: number;
  executionRate: number;
}
