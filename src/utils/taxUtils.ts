// 원천세 자동계산 유틸 — 강사료·외주비 세액 계산
// 사업소득 3.3% / 기타소득 8.8% / 면세·없음 지원

import type { PayrollTaxRateType } from '../types/database';

export interface TaxCalcResult {
  taxAmount: number;
  netAmount: number;
}

/** 세전 금액에서 원천세·실지급액 계산 (소수점 내림 — 원 단위) */
export function calcTax(subtotal: number, rateType: PayrollTaxRateType): TaxCalcResult {
  const base = Math.max(0, Math.floor(subtotal));
  if (rateType === '3.3') {
    const taxAmount = Math.floor(base * 0.033);
    return { taxAmount, netAmount: base - taxAmount };
  }
  if (rateType === '8.8') {
    const taxAmount = Math.floor(base * 0.088);
    return { taxAmount, netAmount: base - taxAmount };
  }
  return { taxAmount: 0, netAmount: base };
}

export const TAX_RATE_LABEL: Record<PayrollTaxRateType, string> = {
  '3.3': '사업소득 3.3%',
  '8.8': '기타소득 8.8%',
  '면세': '면세',
  '없음': '해당없음',
};

export const TAX_RATE_VALUES: PayrollTaxRateType[] = ['3.3', '8.8', '면세', '없음'];
