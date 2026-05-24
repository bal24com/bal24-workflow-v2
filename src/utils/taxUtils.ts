// 원천세·부가세 자동계산 유틸 — 강사료·외주비 세액 계산
// 사업소득 3.3% / 기타소득 8.8% / 부가세 10% (포함) / 면세·없음 지원

import type { PayrollTaxRateType } from '../types/database';

export interface TaxCalcResult {
  taxAmount: number;
  netAmount: number;
}

/**
 * 세전 금액에서 원천세·실지급액 계산 (소수점 내림 — 원 단위).
 *
 * - '3.3' / '8.8' = 원천징수 — taxAmount 만큼 빠지고 netAmount 가 실수령
 * - '10' = 부가세 10% (포함) — subtotal 이 부가세 포함 금액. 실지급은 그대로,
 *   taxAmount 는 그 안에 포함된 부가세 금액 (subtotal / 11)
 * - '면세' / '없음' = taxAmount 0
 */
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
  if (rateType === '10') {
    // 부가세 10% 포함 — 지급액에서 빠지지 않음, 참고용 분리 표시
    const taxAmount = Math.floor(base / 11);
    return { taxAmount, netAmount: base };
  }
  return { taxAmount: 0, netAmount: base };
}

export const TAX_RATE_LABEL: Record<PayrollTaxRateType, string> = {
  '3.3': '사업소득 3.3%',
  '8.8': '기타소득 8.8%',
  '10':  '부가세 10% (포함)',
  '면세': '면세',
  '없음': '해당없음',
};

export const TAX_RATE_VALUES: PayrollTaxRateType[] = ['3.3', '8.8', '10', '면세', '없음'];
