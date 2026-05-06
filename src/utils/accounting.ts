// bal24 v2 — 회계 공통 (계정과목 코드 + 원천징수 미리보기)
//
// ⚠ DB 동기화 주의:
//   withholding_rate / withholding_amount / net_amount 셋 다 expenses 테이블의
//   GENERATED COLUMN. INSERT/UPDATE 시 절대 직접 보내지 말 것.
//   calcWithholding()은 폼에서 사용자에게 미리보기만 표시하는 용도.

import type {
  IncomeStatus,
  ExpenseStatus,
  ReceiptType,
  WithholdingType,
} from '../types/database';

// ─── 계정과목 코드 ───────────────────────────────────
export type AccountCode = {
  code: string;
  label: string;
  description?: string;
};

export const INCOME_ACCOUNT_CODES: AccountCode[] = [
  { code: 'INCOME_SALES',    label: '용역매출', description: '교육·컨설팅·행사 운영비' },
  { code: 'INCOME_GRANT',    label: '지원금',  description: '정부·재단 사업 지원금' },
  { code: 'INCOME_SUBSIDY',  label: '보조금',  description: '지자체 보조금' },
  { code: 'INCOME_DONATION', label: '후원금',  description: '기업·개인 후원' },
  { code: 'INCOME_OTHER',    label: '기타수입' },
];

export const EXPENSE_ACCOUNT_CODES: AccountCode[] = [
  { code: 'EXPENSE_LECTURE',   label: '강사료',     description: '외부 강사·전문가' },
  { code: 'EXPENSE_LABOR',     label: '인건비',     description: '내부 인력' },
  { code: 'EXPENSE_VENUE',     label: '장소대여',   description: '회의실·강의장' },
  { code: 'EXPENSE_MATERIAL',  label: '자료/물품',  description: '교재·물품 구입' },
  { code: 'EXPENSE_FOOD',      label: '식대',       description: '식비·다과' },
  { code: 'EXPENSE_TRANSPORT', label: '교통/숙박',  description: '이동·숙박비' },
  { code: 'EXPENSE_PRINTING',  label: '인쇄/제작',  description: '인쇄·디자인·제작비' },
  { code: 'EXPENSE_OTHER',     label: '기타' },
];

export function findIncomeCode(code: string): AccountCode | undefined {
  return INCOME_ACCOUNT_CODES.find((c) => c.code === code);
}

export function findExpenseCode(code: string): AccountCode | undefined {
  return EXPENSE_ACCOUNT_CODES.find((c) => c.code === code);
}

// ─── 원천징수 ─────────────────────────────────────
export type WithholdingOption = {
  type: WithholdingType;
  label: string;
  rate: number; // 0 ~ 1
  description?: string;
};

export const WITHHOLDING_OPTIONS: WithholdingOption[] = [
  { type: 'none',         label: '없음',     rate: 0 },
  { type: 'business_3_3', label: '사업소득 (3.3%)', rate: 0.033, description: '소득세 3% + 지방세 0.3%' },
  { type: 'other_8_8',    label: '기타소득 (8.8%)', rate: 0.088, description: '실효세율 8.8% (강연료·원고료 등)' },
];

export function findWithholdingOption(type: WithholdingType): WithholdingOption {
  return WITHHOLDING_OPTIONS.find((o) => o.type === type) ?? WITHHOLDING_OPTIONS[0];
}

/**
 * UI 미리보기 전용 — INSERT 시에는 보내지 말 것 (DB GENERATED).
 *
 * @param type    원천징수 유형
 * @param gross   세전 지급액
 * @returns       { rate, withholding, net } — 1원 단위 절사
 */
export function calcWithholding(
  type: WithholdingType,
  gross: number,
): { rate: number; withholding: number; net: number } {
  const opt = findWithholdingOption(type);
  if (!gross || gross <= 0) {
    return { rate: opt.rate, withholding: 0, net: 0 };
  }
  // 1원 미만 절사 (한국 원천징수 관행)
  const withholding = Math.floor(gross * opt.rate);
  const net = gross - withholding;
  return { rate: opt.rate, withholding, net };
}

// ─── 상태/영수증 라벨 ─────────────────────────────
export const INCOME_STATUS_VALUES: IncomeStatus[] = ['대기', '입금완료', '반려'];
export const EXPENSE_STATUS_VALUES: ExpenseStatus[] = ['대기', '출금완료', '반려'];
export const RECEIPT_TYPE_VALUES: ReceiptType[] = [
  '영수증', '세금계산서', '간이영수증', '계좌이체', '카드전표', '기타',
];

// ─── 포맷터 ───────────────────────────────────────
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
