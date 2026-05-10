// bal24 v2 — STEP-PROJECT-ROLE-UNIFIED-TS
// projects.our_role 상수 + 라벨·배지 헬퍼.

export type OurRole = 'operator' | 'member';

export const OUR_ROLE_VALUES: OurRole[] = ['operator', 'member'];

export const OUR_ROLE_LABELS: Record<OurRole, string> = {
  operator: '운영사',
  member:   '참여사',
};

export const OUR_ROLE_DESCRIPTIONS: Record<OurRole, string> = {
  operator: '사업 주관·운영',
  member:   '컨소시엄 참여',
};

/** 배지 색상 (Tailwind class) — operator=Primary 보라 / member=Secondary 주황 */
export const OUR_ROLE_BADGE_TONE: Record<OurRole, string> = {
  operator: 'bg-violet-100 text-violet-700 border-violet-200',
  member:   'bg-orange-100 text-orange-700 border-orange-200',
};

const FALLBACK_LABEL = OUR_ROLE_LABELS.operator;
const FALLBACK_TONE = OUR_ROLE_BADGE_TONE.operator;

export function getOurRoleLabel(role: string | null | undefined): string {
  if (!role) return FALLBACK_LABEL;
  return OUR_ROLE_LABELS[role as OurRole] ?? FALLBACK_LABEL;
}

export function getOurRoleBadgeTone(role: string | null | undefined): string {
  if (!role) return FALLBACK_TONE;
  return OUR_ROLE_BADGE_TONE[role as OurRole] ?? FALLBACK_TONE;
}
