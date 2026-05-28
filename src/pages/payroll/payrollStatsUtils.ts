// 외주·급여 통계 계산 유틸 (박경수님 2026-05-28 STEP-PAYROLL-UI-FIX).
// 박경수님 환경 컬럼명에 맞춤 — expense_type / payment_status / subtotal / receipt_urls.

import { isPersonCategory } from './payrollUtils';

interface PayrollLikeRow {
  expense_type: string;
  payment_status: string | null;
  subtotal: number | null;
}

export interface PayrollStats {
  totalCount: number;
  ops:   { done: number; pending: number; totalAmount: number };
  labor: { done: number; pending: number; totalAmount: number };
}

export function calcPayrollStats(items: PayrollLikeRow[]): PayrollStats {
  const isPaid   = (i: PayrollLikeRow) => i.payment_status === 'paid';
  const isActive = (i: PayrollLikeRow) => !['cancelled', 'rejected'].includes(i.payment_status ?? '');

  // 인건비 = isPersonCategory(expense_type) — 운영인건비도 인건비로 분류
  const labor = items.filter((i) => isPersonCategory(i.expense_type));
  const ops   = items.filter((i) => !isPersonCategory(i.expense_type));

  const sum = (arr: PayrollLikeRow[]) => arr.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);

  return {
    totalCount: items.length,
    ops:   {
      done:    ops.filter(isPaid).length,
      pending: ops.filter((i) => isActive(i) && !isPaid(i)).length,
      totalAmount: sum(ops),
    },
    labor: {
      done:    labor.filter(isPaid).length,
      pending: labor.filter((i) => isActive(i) && !isPaid(i)).length,
      totalAmount: sum(labor),
    },
  };
}

export function formatKRWShort(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`;
  if (amount >= 10_000)      return `${Math.floor(amount / 10_000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}
