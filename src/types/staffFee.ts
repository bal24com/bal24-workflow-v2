// bal24 v2 — STEP-STAFF-FEE-TAX 타입 정의
// program_staff_fees 테이블 + UI 라벨/배지 매핑.

export type FeeType = 'education' | 'mentoring' | 'consulting' | 'facilitation' | 'etc';
export type TaxType = '3.3' | '8.8' | '면세';
export type InputMode = 'unit' | 'total';
export type PaymentStatus = '미지급' | '신고완료' | '지급완료';

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  education:    '교육 강의',
  mentoring:    '멘토링',
  consulting:   '컨설팅',
  facilitation: '진행/퍼실리테이션',
  etc:          '기타',
};

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  '3.3': '3.3% 사업소득',
  '8.8': '8.8% 기타소득',
  '면세': '면세',
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, { label: string; color: string }> = {
  '미지급':   { label: '미지급',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
  '신고완료': { label: '신고완료', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  '지급완료': { label: '지급완료', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const PAYMENT_STATUS_FLOW: PaymentStatus[] = ['미지급', '신고완료', '지급완료'];

export interface StaffFee {
  id: string;
  program_id: string;
  expert_id: string | null;
  profile_id: string | null;
  fee_type: FeeType;
  description: string | null;
  input_mode: InputMode;
  unit_price: number;
  quantity: number;
  gross_amount: number;
  tax_type: TaxType;
  tax_amount: number;
  net_amount: number;
  payment_status: PaymentStatus;
  paid_at: string | null;
  /** 박경수님 요청 — 강의·운영 기간 (선택). DB 컬럼 미적용 시 null 로 처리. */
  period_start_date?: string | null;
  period_end_date?: string | null;
  note: string | null;
  /** STEP-STAFF-FEE-EXPENSES-LINK — 자동 생성된 expenses row FK */
  expense_id?: string | null;
  created_at: string;
  // join
  expert_name?: string | null;
  profile_name?: string | null;
}

export interface FeeCalculation {
  grossAmount: number;
  taxAmount: number;  // 원 단위 절사
  netAmount: number;
  taxRate: number;
}
