// 외주/급여 fetch · 통계 유틸 — PayrollPage·FormModal·ImportModal 공용
// STEP-ACCOUNTING-ALL P3

import { supabase } from '../../lib/supabase';
import type {
  PayrollExpense, PayrollExpenseType, PayrollPaymentStatus, PayrollTaxRateType,
} from '../../types/database';

export type PayrollRow = PayrollExpense & {
  project?: { id: string; name: string; deleted_at: string | null } | null;
  program?: { id: string; name: string; deleted_at: string | null } | null;
  // STEP-ACCOUNTING-FOLLOWUP7 — 수입/계약 연결 (외주/급여가 어느 계약 소속인지)
  contract?: { id: string; contract_name: string; deleted_at: string | null } | null;
};

// STEP-ACCOUNTING-FOLLOWUP2 — 카테고리 자유 입력. prefix 매칭으로 outsource/operation 분류.
export const OUTSOURCE_PREFIXES = ['강사료', '촬영', '기타외주'];
export const OPERATION_PREFIXES = ['운영비', '운영인건비'];

export const PAYROLL_BASE_TYPES: PayrollExpenseType[] = [
  ...OUTSOURCE_PREFIXES, ...OPERATION_PREFIXES,
];

/** 카테고리가 외주 그룹인지 판정 (prefix 매칭). */
export function isOutsourceType(type: string): boolean {
  return OUTSOURCE_PREFIXES.some((p) => type === p || type.startsWith(`${p}-`));
}
/** 카테고리가 운영 그룹인지 판정. */
export function isOperationType(type: string): boolean {
  return OPERATION_PREFIXES.some((p) => type === p || type.startsWith(`${p}-`));
}

// 박경수님 환경 견적 expense_type 은 자유 입력 한글 ("인건비"·"강사비"·"운영비"·"숙식 및 임차" 등).
// isOutsourceType prefix(강사료/촬영/기타외주) 외에 한글 키워드도 인건비로 인식.
// 박경수님 + SkyClaw 2026-05-26 — 지급요청 상단 집계 '기타' 버킷 + 인건비 탭 누락 버그 fix.
const PERSON_KEYWORDS = ['인건비', '강사', '멘토', '운영진', 'ta', '튜터', '컨설'];
export function isPersonCategory(type: string): boolean {
  if (isOutsourceType(type)) return true;
  const lower = (type ?? '').toLowerCase();
  return PERSON_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}
/** 인건비가 아니면 운영비로 간주 (자유 입력 카테고리 포괄). */
export function isCompanyCategory(type: string): boolean {
  return !isPersonCategory(type);
}

// 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28) — 영문 6단계
// UI 표시는 PAYROLL_STATUS_LABEL 매핑으로 한글 유지
export const PAYROLL_STATUS_VALUES: PayrollPaymentStatus[] = [
  'draft', 'submitted', 'received', 'processing', 'paid', 'cancelled',
];

export const PAYROLL_STATUS_LABEL: Record<PayrollPaymentStatus, string> = {
  draft:      '작성중',
  submitted:  '전송됨',
  received:   '수신확인',
  processing: '처리중',
  paid:       '완료',
  cancelled:  '취소',
};

export const PAYROLL_STATUS_STYLE: Record<PayrollPaymentStatus, string> = {
  draft:      'bg-slate-50 text-slate-600 border-slate-200',
  submitted:  'bg-violet-50 text-violet-700 border-violet-200',
  received:   'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  paid:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:  'bg-rose-50 text-rose-700 border-rose-200',
};

export interface PayrollFilter {
  // STEP-ACCOUNTING-FOLLOWUP2 — types[] 대신 outsource/operation 그룹으로 (자유 카테고리 prefix 매칭)
  // 'all' = 외주+운영 통합 (박경수님 요청 — 페이지 [통계][지출] 2탭 구조)
  group: 'outsource' | 'operation' | 'all';
  projectId?: string;
  status?: PayrollPaymentStatus | 'all';
  month?: string; // YYYY-MM
  // 박경수님 + SkyClaw — submitted_at 필터 ('submitted'=확정만, 'draft'=초안만, 'all'=둘다). default='submitted' (외주/급여 페이지)
  submittedFilter?: 'submitted' | 'draft' | 'all';
}

/** 목록 조회 (휴지통 자동 제외, 그룹은 클라이언트 prefix 필터) */
export async function fetchPayroll(filter: PayrollFilter): Promise<PayrollRow[]> {
  let q = supabase
    .from('payroll_expenses')
    .select('*, project:projects(id, name, deleted_at), program:programs(id, name, deleted_at), contract:income_contracts(id, contract_name, deleted_at)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filter.projectId) q = q.eq('project_id', filter.projectId);
  if (filter.status && filter.status !== 'all') q = q.eq('payment_status', filter.status);
  // 박경수님 + SkyClaw — 외주/급여 페이지는 [지출 요청] 실행된 행만 (submitted_at IS NOT NULL). default 'submitted'
  const submittedFilter = filter.submittedFilter ?? 'submitted';
  if (submittedFilter === 'submitted') q = q.not('submitted_at', 'is', null);
  else if (submittedFilter === 'draft') q = q.is('submitted_at', null);

  if (filter.month) {
    const [y, m] = filter.month.split('-').map(Number);
    if (y && m) {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      q = q.gte('paid_at', start).lte('paid_at', end);
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error('[payroll] 목록 조회 실패:', error.message);
    throw new Error('외주/급여 목록을 불러오지 못했어요.');
  }
  return ((data ?? []) as unknown as PayrollRow[])
    .filter((r) => !r.project?.deleted_at && !r.program?.deleted_at && !r.contract?.deleted_at)
    // 그룹 prefix 매칭 (자유 입력 카테고리도 포함). 'all' 은 통합
    .filter((r) => filter.group === 'all'
      ? true
      : filter.group === 'outsource' ? isOutsourceType(r.expense_type) : isOperationType(r.expense_type));
}

/** 특정 계약에 묶인 외주/급여 fetch — ContractDetailDrawer 용 */
export async function fetchPayrollByContract(contractId: string): Promise<PayrollRow[]> {
  const { data, error } = await supabase
    .from('payroll_expenses')
    .select('*, project:projects(id, name, deleted_at), program:programs(id, name, deleted_at), contract:income_contracts(id, contract_name, deleted_at)')
    .eq('contract_id', contractId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[payroll] 계약별 조회 실패:', error.message);
    throw new Error('계약에 묶인 외주/급여를 불러오지 못했어요.');
  }
  return ((data ?? []) as unknown as PayrollRow[]);
}

/** soft-delete */
export async function softDeletePayroll(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('payroll_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[payroll] 삭제 실패:', error.message);
    return '삭제 중 오류가 발생했어요.';
  }
  return null;
}

// STEP-PAYROLL-STATUS-FLOW (2026-05-28) — 6단계 상태 전환 + 추적 컬럼 기록 + 감사 흔적
export async function transitionPayrollStatus(
  id: string,
  next: PayrollPaymentStatus,
  extras: { paidAt?: string; cancelReason?: string } = {},
  userId?: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { payment_status: next };
  if (next === 'received')   { updates.received_at   = now; if (userId) updates.received_by   = userId; }
  if (next === 'processing') { updates.processing_at = now; if (userId) updates.processing_by = userId; }
  if (next === 'paid')       { updates.paid_at = extras.paidAt ?? now; if (userId) updates.paid_by = userId; }
  if (next === 'cancelled')  updates.cancel_reason = extras.cancelReason ?? '';
  const { error } = await supabase.from('payroll_expenses').update(updates).eq('id', id);
  if (error) {
    console.error('[payroll] 상태 전환 실패:', error.message);
    return error.message;
  }
  return null;
}

// STEP-PAYROLL-STATUS-FLOW (2026-05-28) — PM 전송취소 = submitted → draft (received 전까지)
export async function cancelSubmitRequest(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('payroll_expenses')
    .update({ payment_status: 'draft', submitted_at: null })
    .eq('id', id)
    .eq('payment_status', 'submitted'); // 안전망 — 이미 received/processing/paid 면 차단
  if (error) {
    console.error('[payroll] 전송취소 실패:', error.message);
    return error.message;
  }
  return null;
}

// 박경수님 + SkyClaw — [지출 요청] 실행 = submitted_at 기록 + payment_status 'draft' → 'submitted'
// STEP-PAYROLL-STATUS-FLOW (2026-05-28) — 영문 6단계 워크플로우 진입점
export async function submitPaymentRequests(ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const { error } = await supabase
    .from('payroll_expenses')
    .update({ submitted_at: new Date().toISOString(), payment_status: 'submitted' })
    .in('id', ids)
    .is('submitted_at', null); // 이미 확정된 행은 건드리지 않음
  if (error) {
    console.error('[payroll] 지출요청 실행 실패:', error.message);
    const raw = error.message.toLowerCase();
    if (raw.includes('column') && raw.includes('submitted_at')) {
      return 'submitted_at 컬럼이 누락됐어요. 20260526_payroll_submitted_at.sql 을 실행해 주세요.';
    }
    if (raw.includes('row-level security')) {
      return 'RLS UPDATE 정책이 없어요. 20260526_payroll_expenses_rls.sql 을 실행해 주세요.';
    }
    return '지출 요청 실행 중 오류가 발생했어요.';
  }
  return null;
}

// 박경수님 + SkyClaw — 일괄 선택삭제 (soft-delete). RLS UPDATE 정책 필수 (20260526_payroll_expenses_rls.sql)
export async function bulkSoftDeletePayroll(ids: string[]): Promise<string | null> {
  if (ids.length === 0) return null;
  const { error } = await supabase
    .from('payroll_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) {
    console.error('[payroll] 일괄 삭제 실패:', error.message);
    if (error.message.toLowerCase().includes('row-level security')) {
      return 'RLS 정책 누락 — 20260526_payroll_expenses_rls.sql 을 실행해 주세요.';
    }
    return '일괄 삭제 중 오류가 발생했어요.';
  }
  return null;
}

/** 합계 — 세전·원천세·실지급 */
export interface PayrollSummary {
  subtotal: number;
  taxAmount: number;
  netAmount: number;
  count: number;
}
export function calcPayrollSummary(rows: PayrollRow[]): PayrollSummary {
  return rows.reduce<PayrollSummary>(
    (acc, r) => ({
      subtotal: acc.subtotal + Number(r.subtotal ?? 0),
      taxAmount: acc.taxAmount + Number(r.tax_amount ?? 0),
      netAmount: acc.netAmount + Number(r.net_amount ?? 0),
      count: acc.count + 1,
    }),
    { subtotal: 0, taxAmount: 0, netAmount: 0, count: 0 },
  );
}

/** 주민번호 마스킹 (앞 6자리 + 뒤 ******) */
export function maskIdNo(idNo: string | null | undefined): string {
  if (!idNo) return '';
  const clean = idNo.replace(/[^0-9]/g, '');
  if (clean.length < 7) return idNo;
  return `${clean.slice(0, 6)}-*******`;
}

/** Excel import 컬럼 매핑 (현행 강사료 엑셀 양식) */
export interface ImportRow {
  expense_type?: PayrollExpenseType;
  description?: string;
  payee_name?: string;
  payee_id_no?: string;
  bank_name?: string;
  bank_account?: string;
  unit_price?: number;
  quantity?: number;
  tax_rate_type?: PayrollTaxRateType;
}

export const IMPORT_COLUMN_MAP: Record<string, keyof ImportRow> = {
  '구분':     'expense_type',
  '내용':     'description',
  '성명':     'payee_name',
  '주민번호': 'payee_id_no',
  '은행명':   'bank_name',
  '계좌번호': 'bank_account',
  '단가':     'unit_price',
  '회수':     'quantity',
  '세액구분': 'tax_rate_type',
};
