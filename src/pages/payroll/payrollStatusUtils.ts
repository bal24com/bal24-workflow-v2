// 지출 6단계 상태 흐름 유틸 — 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
// payment_status 영문 6종 enum + 한글 라벨 + 배지 + 전환 규칙. PM↔재무 역할 분리.

export type PayrollStatusFlow =
  | 'draft' | 'submitted' | 'received' | 'processing' | 'paid' | 'cancelled';

export const PAYROLL_FLOW_VALUES: PayrollStatusFlow[] = [
  'draft', 'submitted', 'received', 'processing', 'paid', 'cancelled',
];

/** 한글 라벨 — UI 표시는 한글 우선 */
export const PAYROLL_FLOW_LABEL: Record<PayrollStatusFlow, string> = {
  draft:      '작성중',
  submitted:  '전송됨',
  received:   '수신확인',
  processing: '처리중',
  paid:       '완료',
  cancelled:  '취소',
};

/** 배지 스타일 — Tailwind 클래스 */
export const PAYROLL_FLOW_STYLE: Record<PayrollStatusFlow, string> = {
  draft:      'bg-slate-100 text-slate-600 border-slate-200',
  submitted:  'bg-violet-100 text-violet-700 border-violet-200',
  received:   'bg-blue-100 text-blue-700 border-blue-200',
  processing: 'bg-amber-100 text-amber-700 border-amber-200',
  paid:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:  'bg-rose-100 text-rose-600 border-rose-200',
};

/** 상태별 설명 — tooltip / 안내문 */
export const PAYROLL_FLOW_DESC: Record<PayrollStatusFlow, string> = {
  draft:      '작성 중 — 전송 전 초안 (PM 이 자유 수정 가능)',
  submitted:  '전송됨 — 재무팀에 처리 요청 완료',
  received:   '수신확인 — 재무팀이 수신 확인했어요',
  processing: '처리중 — 입금 진행 중',
  paid:       '완료 — 지급 완료',
  cancelled:  '취소 — 반려·취소된 항목',
};

/** PM 전환 규칙 — PM 은 draft↔submitted 만 가능 (수신확인 전까지 전송취소 허용) */
export const PM_TRANSITIONS: Partial<Record<PayrollStatusFlow, PayrollStatusFlow[]>> = {
  draft:     ['submitted'],
  submitted: ['draft'], // 전송취소 (received 전까지)
};

/** 재무 전환 규칙 — submitted→received→processing→paid + 어디서든 cancelled */
export const FINANCE_TRANSITIONS: Partial<Record<PayrollStatusFlow, PayrollStatusFlow[]>> = {
  submitted:  ['received', 'cancelled'],
  received:   ['processing', 'cancelled'],
  processing: ['paid', 'cancelled'],
};

/** role 기반 전환 가능 여부 */
export function canTransition(
  current: PayrollStatusFlow,
  next: PayrollStatusFlow,
  opts: { isFinance: boolean; isPM: boolean },
): boolean {
  if (opts.isFinance) {
    return FINANCE_TRANSITIONS[current]?.includes(next) ?? false;
  }
  if (opts.isPM) {
    return PM_TRANSITIONS[current]?.includes(next) ?? false;
  }
  return false;
}

/** 행이 수정/삭제 가능한 상태인지 — PM 은 draft 만, finance 는 cancelled/paid 외 전부 */
export function canEditRow(
  status: PayrollStatusFlow,
  opts: { isFinance: boolean; isPM: boolean },
): boolean {
  if (opts.isFinance) return status !== 'paid' && status !== 'cancelled';
  if (opts.isPM)      return status === 'draft';
  return false;
}
