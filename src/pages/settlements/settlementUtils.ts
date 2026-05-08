// bal24 v2 — 정산 단계 라벨·컬러·완료 판정 헬퍼 (STEP-SETTLEMENT-WORKFLOW)
// SettlementPage·SettlementActionModal 양쪽에서 재사용.

import type { ProjectSettlementRow, SettlementStep } from '../../types/database';

export const SETTLEMENT_STEP_LABEL: Record<SettlementStep, string> = {
  1: '보고서 대기',
  2: '승인 대기',
  3: '세금계산서',
  4: '입금 확인',
  5: '출금 처리',
};

export const SETTLEMENT_STEP_COLOR: Record<SettlementStep, string> = {
  1: 'bg-slate-100 text-slate-600 border-slate-200',
  2: 'bg-orange-100 text-orange-700 border-orange-200',
  3: 'bg-violet-100 text-violet-700 border-violet-200',
  4: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  5: 'bg-green-100 text-green-700 border-green-200',
};

const DONE_COLOR = 'bg-emerald-200 text-emerald-800 border-emerald-300';

/** 완료 판정: step=5 + paid_out_at 존재 */
export function isSettlementDone(s: ProjectSettlementRow): boolean {
  return s.current_step === 5 && !!s.paid_out_at;
}

/** 단계 라벨 (완료 상태 포함) */
export function getStepLabel(s: ProjectSettlementRow): string {
  if (isSettlementDone(s)) return '정산 완료';
  return `${s.current_step}. ${SETTLEMENT_STEP_LABEL[s.current_step] ?? `${s.current_step}단계`}`;
}

/** 단계 컬러 (배지 className) */
export function getStepColor(s: ProjectSettlementRow): string {
  if (isSettlementDone(s)) return DONE_COLOR;
  return SETTLEMENT_STEP_COLOR[s.current_step] ?? 'bg-slate-100 text-slate-600 border-slate-200';
}

/** 가장 최근 timestamp (요약 카드용) */
export function lastUpdatedAt(s: ProjectSettlementRow): string | null {
  return s.paid_out_at ?? s.received_at ?? s.invoice_at ?? s.approved_at ?? s.updated_at ?? s.created_at ?? null;
}
