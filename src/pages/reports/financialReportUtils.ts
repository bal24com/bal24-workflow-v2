// bal24 v2 — 재무 리포트 집계·변환·레이아웃 유틸 (STEP 20)
// STEP 13의 reportUtils.ts(결과보고서)와 별개 도메인.

import { supabase } from '../../lib/supabase';
import { findIncomeCode, findExpenseCode } from '../../utils/accounting';
import type { LedgerType } from '../../types/database';

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface AccountExpense {
  accountCode: string;
  label: string;
  amount: number;
  ratio: number;
}

export interface UnpaidExpense {
  id: string;
  description: string | null;
  gross_amount: number;
  expense_date: string;
  account_code: string;
  account_label: string;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  projectCount: number;
  unpaidExpenseCount: number;
}

// ─── 레이아웃 (커스터마이징) ─────────────────────────
export type LayoutItemKey =
  | 'kpi_income'
  | 'kpi_expense'
  | 'kpi_net'
  | 'kpi_project'
  | 'chart_bar'
  | 'chart_donut'
  | 'list_unpaid';

export interface LayoutItem {
  key: LayoutItemKey;
  visible: boolean;
  order: number;
}

export const LAYOUT_LABEL: Record<LayoutItemKey, string> = {
  kpi_income: 'KPI — 총 수입',
  kpi_expense: 'KPI — 총 지출',
  kpi_net: 'KPI — 순이익',
  kpi_project: 'KPI — 진행 중 프로젝트',
  chart_bar: '월별 수입·지출 막대 차트',
  chart_donut: '계정과목별 도넛 차트',
  list_unpaid: '미지급 지출 목록',
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { key: 'kpi_income', visible: true, order: 0 },
  { key: 'kpi_expense', visible: true, order: 1 },
  { key: 'kpi_net', visible: true, order: 2 },
  { key: 'kpi_project', visible: true, order: 3 },
  { key: 'chart_bar', visible: true, order: 4 },
  { key: 'chart_donut', visible: true, order: 5 },
  { key: 'list_unpaid', visible: true, order: 6 },
];

const ALL_KEYS: LayoutItemKey[] = [
  'kpi_income',
  'kpi_expense',
  'kpi_net',
  'kpi_project',
  'chart_bar',
  'chart_donut',
  'list_unpaid',
];

/** DB 레이아웃을 정규화 — 누락된 키는 visible:false 로 보충 */
export function normalizeLayout(stored: LayoutItem[] | null | undefined): LayoutItem[] {
  if (!stored || stored.length === 0) return [...DEFAULT_LAYOUT];
  const map = new Map<LayoutItemKey, LayoutItem>();
  for (const item of stored) {
    if (ALL_KEYS.includes(item.key)) {
      map.set(item.key, { key: item.key, visible: !!item.visible, order: Number(item.order) });
    }
  }
  let nextOrder = Math.max(0, ...Array.from(map.values()).map((i) => i.order)) + 1;
  for (const k of ALL_KEYS) {
    if (!map.has(k)) {
      map.set(k, { key: k, visible: false, order: nextOrder });
      nextOrder += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

/** 연도 선택 목록 (2024 ~ 현재) */
export function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: Math.max(1, current - 2023) }, (_, i) => 2024 + i);
}

/** KPI 요약 집계 */
export async function fetchSummary(year: number, ledgerType: LedgerType): Promise<ReportSummary> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [incomeRes, expenseRes, projectRes, unpaidRes] = await Promise.all([
    supabase
      .from('income')
      .select('amount')
      .eq('ledger_type', ledgerType)
      .gte('received_at', start)
      .lte('received_at', end)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('gross_amount')
      .eq('ledger_type', ledgerType)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .is('deleted_at', null),
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .in('status', ['진행', '정산']),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('status', '대기')
      .eq('ledger_type', ledgerType)
      .is('deleted_at', null),
  ]);

  if (incomeRes.error) console.error('[reports] income 집계 실패:', incomeRes.error.message);
  if (expenseRes.error) console.error('[reports] expense 집계 실패:', expenseRes.error.message);
  if (projectRes.error) console.error('[reports] project 카운트 실패:', projectRes.error.message);
  if (unpaidRes.error) console.error('[reports] 미지급 카운트 실패:', unpaidRes.error.message);

  const totalIncome = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalExpense = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);

  return {
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    projectCount: projectRes.count ?? 0,
    unpaidExpenseCount: unpaidRes.count ?? 0,
  };
}

/** 월별 수입·지출 집계 */
export async function fetchMonthly(year: number, ledgerType: LedgerType): Promise<MonthlyData[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from('income')
      .select('amount, received_at')
      .eq('ledger_type', ledgerType)
      .gte('received_at', start)
      .lte('received_at', end)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('gross_amount, expense_date')
      .eq('ledger_type', ledgerType)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .is('deleted_at', null),
  ]);

  if (incomeRes.error) console.error('[reports] 월별 income 실패:', incomeRes.error.message);
  if (expenseRes.error) console.error('[reports] 월별 expense 실패:', expenseRes.error.message);

  const months: MonthlyData[] = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    income: 0,
    expense: 0,
    net: 0,
  }));

  for (const r of incomeRes.data ?? []) {
    if (!r.received_at) continue;
    const m = (r.received_at as string).slice(0, 7);
    const found = months.find((x) => x.month === m);
    if (found) found.income += Number(r.amount ?? 0);
  }
  for (const r of expenseRes.data ?? []) {
    if (!r.expense_date) continue;
    const m = (r.expense_date as string).slice(0, 7);
    const found = months.find((x) => x.month === m);
    if (found) found.expense += Number(r.gross_amount ?? 0);
  }
  for (const m of months) {
    m.net = m.income - m.expense;
  }
  return months;
}

/** 계정과목별 지출 집계 */
export async function fetchExpenseByAccount(year: number, ledgerType: LedgerType): Promise<AccountExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('account_code, gross_amount')
    .eq('ledger_type', ledgerType)
    .gte('expense_date', `${year}-01-01`)
    .lte('expense_date', `${year}-12-31`)
    .is('deleted_at', null);

  if (error) console.error('[reports] 계정과목 집계 실패:', error.message);

  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const code = r.account_code as string;
    map.set(code, (map.get(code) ?? 0) + Number(r.gross_amount ?? 0));
  }

  const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
  const list: AccountExpense[] = Array.from(map.entries())
    .filter(([, v]) => v > 0)
    .map(([code, amount]) => ({
      accountCode: code,
      label: findExpenseCode(code)?.label ?? findIncomeCode(code)?.label ?? code,
      amount,
      ratio: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return list;
}

/** 미지급 지출 상위 N건 */
export async function fetchUnpaidExpenses(ledgerType: LedgerType, limit = 5): Promise<UnpaidExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, gross_amount, expense_date, account_code')
    .eq('status', '대기')
    .eq('ledger_type', ledgerType)
    .is('deleted_at', null)
    .order('expense_date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[reports] 미지급 목록 조회 실패:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    description: (r.description as string | null) ?? null,
    gross_amount: Number(r.gross_amount ?? 0),
    expense_date: r.expense_date as string,
    account_code: r.account_code as string,
    account_label: findExpenseCode(r.account_code as string)?.label ?? (r.account_code as string),
  }));
}

/** 사용자별 레이아웃 조회 */
export async function fetchLayout(userId: string, ledgerType: LedgerType): Promise<LayoutItem[]> {
  const { data, error } = await supabase
    .from('report_layouts')
    .select('layout')
    .eq('user_id', userId)
    .eq('ledger_type', ledgerType)
    .maybeSingle();

  if (error) {
    console.error('[reports] 레이아웃 조회 실패:', error.message);
    return [...DEFAULT_LAYOUT];
  }
  return normalizeLayout((data?.layout as LayoutItem[] | null) ?? null);
}

/** 사용자별 레이아웃 저장 (upsert) */
export async function saveLayout(userId: string, ledgerType: LedgerType, layout: LayoutItem[]): Promise<boolean> {
  const payload = {
    user_id: userId,
    ledger_type: ledgerType,
    layout,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('report_layouts')
    .upsert(payload, { onConflict: 'user_id,ledger_type' });
  if (error) {
    console.error('[reports] 레이아웃 저장 실패:', error.message);
    return false;
  }
  return true;
}

/** 금액 포맷 (천 단위 콤마 + "원") */
export function formatAmount(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 큰 금액을 만/억 단위로 짧게 (차트 축 라벨용) */
export function formatAmountShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${Math.round(n / 10000).toLocaleString('ko-KR')}만`;
  return n.toLocaleString('ko-KR');
}
