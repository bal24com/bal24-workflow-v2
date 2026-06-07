// bal24 v2 — 멘토링 타입 + 계산 헬퍼 (STEP-MENTORING)

export type MentoringMeetType = '대면' | '비대면' | '혼합';
export type MentoringSessionMeetType = '대면' | '비대면';
export type MentoringPayType = '단가×회수' | '전체계약';
export type MentoringTaxType = '3.3%' | '8.8%' | '면세';
export type MentoringStatus = '진행' | '완료' | '취소';

interface MentorJoin {
  id: string;
  name: string;
  specialty: string[] | null;
}

export interface MentoringAssignment {
  id: string;
  program_id: string;
  mentor_pool_id: string | null;
  mentor_profile_id: string | null;
  /** STEP-MENTORING-FULL — 미등록 멘토 이름 (pool/profile null일 때) */
  mentor_name_raw?: string | null;
  /** STEP-MENTORING-FULL — 외부 멘토 초대 토큰 */
  mentor_invite_token?: string | null;
  mentee_ids: string[] | null;
  meet_type: MentoringMeetType | null;
  pay_type: MentoringPayType | null;
  unit_price: number | null;
  session_count: number | null;
  contract_amount: number | null;
  tax_type: MentoringTaxType;
  tax_type_locked: boolean;
  mentor_access_token: string;
  mentee_access_token: string;
  pm_note: string | null;
  status: MentoringStatus;
  created_at: string;
  updated_at: string;
  // join
  mentor_pool?: MentorJoin | null;
  mentor_profile?: MentorJoin | null;
  sessions?: MentoringSession[];
}

export interface MentoringSession {
  id: string;
  assignment_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_min: number | null;
  session_no: number | null;
  meet_type: MentoringSessionMeetType | null;
  team_name: string | null;
  item_name: string | null;
  attendee_names: string | null;
  title: string;
  content: string;
  photo_urls: string[] | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface MentoringFeedback {
  id: string;
  session_id: string;
  mentee_id: string | null;
  mentee_name: string | null;
  rating: number | null;
  comment: string | null;
  submitted_at: string;
}

/** STEP-MENTOR-PORTAL-FULL / STEP-MENTORING-P1 — 외부 포털에서 멘토가 작성하는 일지 */
export type MentoringLogStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface MentoringLog {
  id: string;
  assignment_id: string | null;
  program_id: string | null;
  log_date: string;          // YYYY-MM-DD (= mentoring_date 의미)
  session_no: number | null;
  mentee_ids: string[];
  content: string;
  next_plan: string | null;
  /** STEP-MENTORING-LOG-FORM — 멘토링 일지 양식 추가 필드 */
  location: string | null;
  start_time: string | null; // HH:MM
  end_time: string | null;   // HH:MM
  /** STEP-MENTORING-P1 — PDF 양식 기반 확장 + 승인 워크플로 */
  subject: string | null;            // 주제
  duration_min: number | null;       // 진행시간(분)
  recipient: string | null;          // 제출처
  /** 박경수님 2026-05-26 양식 보강 — 참여팀명 (예: "1조 / 우리둥네수호대") */
  team_name: string | null;
  status: MentoringLogStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_note: string | null;
  mentor_signature_url: string | null;
  created_at: string;
  updated_at: string;
}

/** STEP-MENTORING-P1 — 일지 상태 라벨·색상 (한글 표시) */
export const MENTORING_LOG_STATUS_LABEL: Record<MentoringLogStatus, string> = {
  draft: '임시저장', submitted: '검토중', approved: '승인완료', rejected: '반려',
};
export const MENTORING_LOG_STATUS_STYLE: Record<MentoringLogStatus, string> = {
  draft:     'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-100 text-amber-700',
  approved:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-rose-100 text-rose-700',
};

/** 일지 수정 가능 여부 — 임시저장·반려 상태만 작성자가 수정 가능 */
export function canEditMentoringLog(log: Pick<MentoringLog, 'status'>): boolean {
  return log.status === 'draft' || log.status === 'rejected';
}

/** STEP-MENTORING-LOG-UX — 멘토링 일지 첨부 파일 */
export interface MentoringLogFile {
  id: string;
  log_id: string;
  file_name: string;
  file_url: string;
  file_type: 'image' | 'document';
  file_size: number | null;
  created_at: string;
  created_by: string | null;
}

/** 지급 계산 — 완료 회수 기반 */
export function calcMentoringPay(a: MentoringAssignment, completedCount: number) {
  const base =
    a.pay_type === '단가×회수'
      ? (a.unit_price ?? 0) * completedCount
      : (a.contract_amount ?? 0);
  const rate = a.tax_type === '3.3%' ? 0.033 : a.tax_type === '8.8%' ? 0.088 : 0;
  const deduction = Math.floor(base * rate);
  return { base, deduction, net: base - deduction };
}

/** HH:MM 두 시각 사이 분 계산. 잘못된 입력은 0 */
export function calcDurationMin(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const re = /^(\d{1,2}):(\d{2})$/;
  const sm = re.exec(start);
  const em = re.exec(end);
  if (!sm || !em) return 0;
  const sMin = Number(sm[1]) * 60 + Number(sm[2]);
  const eMin = Number(em[1]) * 60 + Number(em[2]);
  return Math.max(0, eMin - sMin);
}

export function formatDuration(min: number | null | undefined): string {
  if (min == null || min <= 0) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** 멘토 이름 — 외부/내부/미등록 자동 분기 */
export function getMentorName(a: MentoringAssignment): string {
  return a.mentor_pool?.name ?? a.mentor_profile?.name ?? a.mentor_name_raw ?? '미배정';
}

/** STEP-MENTORING-FULL — 미등록 멘토 여부 (pool·profile 둘 다 null) */
export function isUnregisteredMentor(a: MentoringAssignment): boolean {
  return !a.mentor_pool_id && !a.mentor_profile_id && !!a.mentor_name_raw;
}

/** 멘토 전문분야 라벨 */
export function getMentorSpecialty(a: MentoringAssignment): string[] {
  return a.mentor_pool?.specialty ?? a.mentor_profile?.specialty ?? [];
}
