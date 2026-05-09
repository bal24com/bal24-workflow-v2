// bal24 v2 — STEP-ROLE-TYPE-AUDIT 역할 상수·헬퍼 중앙 관리
// ⚠️ DB profiles.role 은 항상 소문자 ('admin', 'pm', 'staff', 'finance', 'partner', 'member')
//    이 상수의 value 값과 일치시킬 것.

export const ROLES = {
  ADMIN:   'admin',
  PM:      'pm',
  STAFF:   'staff',
  FINANCE: 'finance',
  PARTNER: 'partner',
  MEMBER:  'member',
} as const;

export type RoleKey = keyof typeof ROLES;
export type RoleValue = typeof ROLES[RoleKey];

/** 모든 역할 값 배열 (드롭다운·필터에 사용) */
export const ROLE_VALUES: RoleValue[] = ['admin', 'pm', 'staff', 'finance', 'partner', 'member'];

/** 역할 한글 라벨 (소문자 role → 한글) */
export const ROLE_LABELS: Record<string, string> = {
  admin:   '관리자',
  pm:      'PM',
  staff:   '직원',
  finance: '재무',
  partner: '파트너',
  member:  '멤버',
};

/** 역할별 배지 색상 (소문자 role → Tailwind class) */
export const ROLE_BADGE_TONE: Record<string, { bg: string; text: string }> = {
  admin:   { bg: 'bg-violet-100',  text: 'text-violet-700' },
  pm:      { bg: 'bg-cyan-100',    text: 'text-cyan-700' },
  staff:   { bg: 'bg-slate-100',   text: 'text-slate-600' },
  finance: { bg: 'bg-orange-100',  text: 'text-orange-700' },
  partner: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  member:  { bg: 'bg-slate-100',   text: 'text-slate-500' },
};

const ROLE_BADGE_FALLBACK = { bg: 'bg-slate-100', text: 'text-slate-500' };

/**
 * 대소문자 무관하게 소문자 역할값 반환.
 * DB 값이 소문자이므로 통상 그대로 사용하되,
 * 레거시 대문자 데이터에 대한 안전망으로 유지.
 */
export function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return role.toString().toLowerCase();
}

/** 역할 보유 여부 확인 (대소문자 무관) */
export function hasRole(
  userRole: string | null | undefined,
  targetRole: RoleValue,
): boolean {
  return normalizeRole(userRole) === targetRole;
}

/** 한글 라벨 조회 (모르는 값이면 원본 또는 '미정') */
export function getRoleLabel(role: string | null | undefined): string {
  const norm = normalizeRole(role);
  if (!norm) return '미정';
  return ROLE_LABELS[norm] ?? norm;
}

/** 배지 색상 조회 — 모르는 값이면 회색 fallback */
export function getRoleBadgeTone(role: string | null | undefined): { bg: string; text: string } {
  const norm = normalizeRole(role);
  if (!norm) return ROLE_BADGE_FALLBACK;
  return ROLE_BADGE_TONE[norm] ?? ROLE_BADGE_FALLBACK;
}
