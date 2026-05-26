// bal24 v2 — 컨소시엄 독립 홈 공통 타입·상수 (STEP-CON)

export const CONSORTIUM_STATUS = ['구성중', '진행', '완료', '해산'] as const;
export type ConsortiumStatus = typeof CONSORTIUM_STATUS[number];

export const MEMBER_TYPE = ['lead', 'co', 'sub', 'observer'] as const;
export type MemberType = typeof MEMBER_TYPE[number];

// STEP-CONSORTIUM-REDESIGN A안 (박경수님 2026-05-27) — '총괄/참여' 통일.
export const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  lead: '총괄',
  co: '참여',
  sub: '참여',
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
  client_id: string | null; // 박경수님 + SkyClaw STEP-CONSORTIUM-UPGRADE-FULL (2026-05-28) — is_self=true 인 자사 멤버는 NULL
  member_type?: MemberType;     // (Legacy — 박경수님 환경 DB 엔 없음. 호환용 optional)
  // STEP-CONSORTIUM-UPGRADE-FULL — 박경수님 환경의 실제 DB 컬럼명
  org_name?: string;            // 박경수님 환경 DB 컬럼 (참여사 기관명, NOT NULL)
  is_self?: boolean;            // true = 밸런스닷 자사 (clients 미등록)
  role?: 'lead' | 'partner';    // lead = 주관사(컨소시엄 총괄), partner = 참여사
  budget_ratio?: number | null; // 박경수님 환경 DB 컬럼 (지분율 %, task_share_pct 대응)
  budget_amount?: number | null;// 박경수님 환경 DB 컬럼 (배분 예산, allocated_budget 대응)
  // (Legacy — 박경수님 환경엔 없는 컬럼. 호환용 optional)
  task_share_pct?: number;
  allocated_budget?: number;
  spent_amount?: number;
  portal_enabled?: boolean;
  updated_at?: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  responsibilities: string | null;
  created_at: string;
  clients?: { id: string; name: string; business_name: string | null } | null;
}

// STEP-CONSORTIUM-UPGRADE-FULL — Consortium 헤더에 lead_is_self 추가
export interface ConsortiumLite {
  id: string;
  name: string;
  status: ConsortiumStatus;
  lead_is_self?: boolean; // true = 밸런스닷 주관사 / false = 밸런스닷 참여사
  total_budget?: number | null;
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
