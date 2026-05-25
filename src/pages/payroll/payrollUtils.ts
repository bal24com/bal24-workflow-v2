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

export const PAYROLL_STATUS_VALUES: PayrollPaymentStatus[] = [
  '대기', '완료', '후순위', '취소',
];

export const PAYROLL_STATUS_STYLE: Record<PayrollPaymentStatus, string> = {
  대기:   'bg-amber-50 text-amber-700 border-amber-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  후순위: 'bg-slate-50 text-slate-600 border-slate-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
};

export interface PayrollFilter {
  // STEP-ACCOUNTING-FOLLOWUP2 — types[] 대신 outsource/operation 그룹으로 (자유 카테고리 prefix 매칭)
  // 'all' = 외주+운영 통합 (박경수님 요청 — 페이지 [통계][지출] 2탭 구조)
  group: 'outsource' | 'operation' | 'all';
  projectId?: string;
  status?: PayrollPaymentStatus | 'all';
  month?: string; // YYYY-MM
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
