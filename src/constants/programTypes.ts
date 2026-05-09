// bal24 v2 — STEP-PROGRAM-TYPE-TS 영문 program_type 상수 + 라벨
// ⚠️ DB programs.program_type 은 영문 enum (한글 표시는 PROGRAM_TYPE_LABELS 매핑)

export const PROGRAM_TYPE_VALUES = [
  'education',
  'support_grant',
  'mentoring',
  'event',
  'experience',
  'market',
  'marketing',
  'delivery',
  'planning',
  'recruitment',
  'fieldwork',
  'report',
  'research',
  'general',
] as const;

export type ProgramTypeKey = typeof PROGRAM_TYPE_VALUES[number];

/** 영문 키 → 한글 라벨 */
export const PROGRAM_TYPE_LABELS: Record<ProgramTypeKey, string> = {
  education:     '교육',
  support_grant: '지원형',
  mentoring:     '멘토링',
  event:         '행사',
  experience:    '체험',
  market:        '마켓',
  marketing:     '마케팅',
  delivery:      '납품',
  planning:      '기획',
  recruitment:   '모집',
  fieldwork:     '이동',
  report:        '보고',
  research:      '조사·연구',
  general:       '기타',
};

/** application_type — 신청 방식 */
export type ApplicationTypeKey = 'open' | 'evaluation';

export const APPLICATION_TYPE_LABELS: Record<ApplicationTypeKey, string> = {
  open:       '일반 접수',
  evaluation: '평가형 선발',
};

/** 모르는 값이면 '기타' 라벨 fallback */
export function getProgramTypeLabel(key: string | null | undefined): string {
  if (!key) return PROGRAM_TYPE_LABELS.general;
  return (PROGRAM_TYPE_LABELS as Record<string, string>)[key] ?? key;
}

/** 모르는 값이면 '일반 접수' fallback */
export function getApplicationTypeLabel(key: string | null | undefined): string {
  if (!key) return APPLICATION_TYPE_LABELS.open;
  return (APPLICATION_TYPE_LABELS as Record<string, string>)[key] ?? key;
}
