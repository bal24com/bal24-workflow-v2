// 직원 급여 공제 계산 유틸 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// 2026년 기준 4대보험 요율. 소득세는 별도 입력 권장 (간이세액표 의존).

const RATES = {
  nationalPension: 0.045,        // 국민연금 4.5%
  healthInsurance: 0.03545,      // 건강보험 3.545%
  longTermCare: 0.1282,          // 장기요양 = 건강보험 × 12.82%
  employmentInsurance: 0.009,    // 고용보험 0.9%
} as const;

export interface DeductionResult {
  nationalPension: number;
  healthInsurance: number;
  longTermCare: number;
  employmentInsurance: number;
  total: number;
}

/** 4대보험 공제액 자동 계산 (소득세·지방소득세 제외). 10원 단위 절사. */
export function calcDeductions(baseSalary: number): DeductionResult {
  const np = Math.floor((baseSalary * RATES.nationalPension) / 10) * 10;
  const hi = Math.floor((baseSalary * RATES.healthInsurance) / 10) * 10;
  const ltc = Math.floor((hi * RATES.longTermCare) / 10) * 10;
  const ei = Math.floor((baseSalary * RATES.employmentInsurance) / 10) * 10;
  return { nationalPension: np, healthInsurance: hi, longTermCare: ltc, employmentInsurance: ei, total: np + hi + ltc + ei };
}

/** 차인지급액 = 기본급 - 공제합계 */
export function calcNetPayment(baseSalary: number, totalDeduction: number): number {
  return baseSalary - totalDeduction;
}

/** 주민번호 마스킹 (앞 6자리만, 뒤 7자리 *) */
export function maskResidentNo(rn: string | null | undefined): string {
  if (!rn) return '-';
  const digits = rn.replace(/[^0-9]/g, '');
  if (digits.length < 7) return rn;
  return `${digits.slice(0, 6)}-*******`;
}

/** 결의서 번호 자동 생성 (EC-YYYYMM-NNN). NNN 은 호출 측에서 시퀀스 부여. */
export function buildClaimNumber(date: Date, seq: number): string {
  const yyyymm = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `EC-${yyyymm}-${String(seq).padStart(3, '0')}`;
}
