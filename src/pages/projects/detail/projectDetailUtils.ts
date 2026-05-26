// bal24 v2 — 프로젝트 상세 개요 탭 집계 유틸 (V7 → V2 이식)
// 재무 합계 / 이벤트 통합 / 활동 로그 / 참여자 미리보기

import { supabase } from '../../../lib/supabase';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import { isOutsourceType, isOperationType } from '../../payroll/payrollUtils';
import type {
  ActivityLog,
  ActivityLogType,
  Program,
  ScheduleEvent,
} from '../../../types/database';

export interface ProjectFinance {
  budget: number;
  contractTotal: number;          // 박경수님 + SkyClaw 2026-05-26 — 전체 사업비 (income_contracts 계약금액 합)
  incomeTotal: number;            // 입금 완료 합계 (구 income + 신 income_contracts)
  expectedIncomeTotal: number;    // 진행중·draft·보류 계약 총액 (신 income_contracts)
  expenseTotal: number;           // 지출 합계 (구 expenses + 신 payroll_expenses)
  pendingExpenseTotal: number;    // 대기 지출 합계
  paidExpenseTotal: number;       // 박경수님 + SkyClaw 2026-05-28 — 집행 완료 (payment_status='완료') 만 집계
  payrollTotal: number;           // 외주/급여 합계 (신 payroll_expenses, 취소 제외)
  // 박경수님 요청 — 견적 + 인건비/운영비 분리
  proposalTotal: number;          // 제안 견적 합계 (project_estimates.total_amount)
  outsourceTotal: number;         // 인건비 (payroll 의 강사료·촬영·기타외주 prefix)
  operationTotal: number;         // 운영비 (payroll 의 운영비·운영인건비 prefix)
  // 박경수님 + SkyClaw 2026-05-26 — 세액 분리
  vatAmount: number;              // 매입세액 = 외주 부가세 (payroll 운영비 tax_amount 합)
  withholdingTax: number;         // 원천세 (인건비 tax_amount 합)
  netExpense: number;             // 순지출 (expenseTotal - vatAmount)
  // 박경수님 + SkyClaw STEP-FINANCE-LABEL-VAT (2026-05-26) — 매출세액 + 납부세액
  salesVat: number;               // 매출세액 = 사업 계약 부가세 (vat_type='과세' 인 income_contracts 의 contract_amount/11, 포함가 역산)
  vatPayable: number;             // 납부 부가세 = max(0, salesVat - vatAmount)
  remaining: number;
  settledPct: number;
}

export interface ProjectMembersPreview {
  totalCount: number;
  recentNames: string[];
}

export interface ProjectEventsBundle {
  programs: Pick<Program, 'id' | 'name' | 'type' | 'status' | 'start_date' | 'end_date' | 'venue'>[];
  schedules: Pick<ScheduleEvent, 'id' | 'title' | 'event_date' | 'start_time' | 'all_day' | 'category'>[];
}

export type ActivityRow = Pick<
  ActivityLog,
  'id' | 'log_type' | 'title' | 'activity_date' | 'duration_hours' | 'attendee_count'
>;

const ACTIVITY_LOG_TYPE_LABEL: Record<ActivityLogType, string> = {
  mentoring: '멘토링',
  lecture: '강의',
  business_trip: '출장',
  ta: 'TA',
  operation: '운영',
  dispatch: '파견',
};

export function activityLogTypeLabel(t: ActivityLogType): string {
  return ACTIVITY_LOG_TYPE_LABEL[t] ?? t;
}

/** 재무 요약 — 구 income/expenses + 신 income_contracts/payroll_expenses + estimates 합산 */
export async function fetchProjectFinance(projectId: string): Promise<ProjectFinance> {
  const [projRes, incomeRes, expenseRes, contractRes, payrollRes, estimateRes] = await Promise.all([
    supabase.from('projects').select('budget').eq('id', projectId).maybeSingle(),
    supabase.from('income').select('amount, status').eq('project_id', projectId).is('deleted_at', null),
    supabase.from('expenses').select('gross_amount, status').eq('project_id', projectId).is('deleted_at', null),
    // 박경수님 + SkyClaw STEP-FINANCE-LABEL-VAT — vat_type 추가 fetch (매출세액 계산용)
    supabase.from('income_contracts').select('contract_amount, status, deposited_at, vat_type').eq('project_id', projectId).is('deleted_at', null),
    // ACCOUNTING-P3 — 박경수님 요청: expense_type 도 fetch 해서 인건비/운영비 분류
    // 박경수님 + SkyClaw 2026-05-26 — tax_amount 도 fetch 해서 부가세·원천세 분리
    supabase.from('payroll_expenses').select('subtotal, tax_amount, tax_rate_type, payment_status, expense_type').eq('project_id', projectId).is('deleted_at', null),
    // 박경수님 요청 — 견적도 재무요약에 합산
    supabase.from('project_estimates').select('total_amount').eq('project_id', projectId).is('deleted_at', null),
  ]);

  if (projRes.error) console.error('[project-detail] 예산 조회 실패:', projRes.error.message);
  if (incomeRes.error) console.error('[project-detail] 수입(legacy) 조회 실패:', incomeRes.error.message);
  if (expenseRes.error) console.error('[project-detail] 지출(legacy) 조회 실패:', expenseRes.error.message);
  if (contractRes.error) console.error('[project-detail] 계약 조회 실패:', contractRes.error.message);
  if (payrollRes.error) console.error('[project-detail] 외주/급여 조회 실패:', payrollRes.error.message);
  if (estimateRes.error) console.error('[project-detail] 견적 조회 실패:', estimateRes.error.message);

  const budget = Number(projRes.data?.budget ?? 0);

  // 수입 — 구 income(입금완료) + 신 income_contracts(deposited_at 채워진 행)
  const legacyIncome = ((incomeRes.data ?? []) as Array<{ amount: number | string | null; status: string }>)
    .filter((r) => r.status === '입금완료').reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const contractRows = (contractRes.data ?? []) as Array<{ contract_amount: number | string | null; status: string; deposited_at: string | null; vat_type: string | null }>;
  const contractIncome = contractRows.filter((r) => r.deposited_at).reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const incomeTotal = legacyIncome + contractIncome;

  // 예상 수입 — 입금 전 계약 (취소 제외)
  const expectedIncomeTotal = contractRows
    .filter((r) => !r.deposited_at && r.status !== '취소')
    .reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);

  // 지출 — 구 expenses(전체) + 신 payroll_expenses(취소 제외)
  const legacyExpenseRows = (expenseRes.data ?? []) as Array<{ gross_amount: number | string | null; status: string }>;
  const legacyExpense = legacyExpenseRows.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
  const legacyPending = legacyExpenseRows.filter((r) => r.status === '대기').reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
  const payrollRows = (payrollRes.data ?? []) as Array<{ subtotal: number | string | null; tax_amount: number | string | null; tax_rate_type: string | null; payment_status: string; expense_type: string }>;
  const livePayroll = payrollRows.filter((r) => r.payment_status !== '취소');
  const payrollTotal = livePayroll.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  const payrollPending = payrollRows.filter((r) => r.payment_status === '대기').reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  // 박경수님 + SkyClaw 2026-05-28 — 집행 완료(payment_status='완료')만 집계 (예정 제외)
  const paidExpenseTotal = payrollRows.filter((r) => r.payment_status === '완료').reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  // 박경수님 요청 — 인건비/운영비 분리 (prefix 매칭)
  const outsourceTotal = livePayroll.filter((r) => isOutsourceType(r.expense_type)).reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  const operationTotal = livePayroll.filter((r) => isOperationType(r.expense_type)).reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  // 박경수님 + SkyClaw 2026-05-26 — 세액 분리. tax_amount 0 이면 운영비는 sub/11 fallback
  const vatAmount = livePayroll.filter((r) => isOperationType(r.expense_type) || r.tax_rate_type === '10')
    .reduce((s, r) => {
      const stored = Number(r.tax_amount ?? 0);
      return s + (stored > 0 ? stored : Math.floor(Number(r.subtotal ?? 0) / 11));
    }, 0);
  const withholdingTax = livePayroll.filter((r) => isOutsourceType(r.expense_type) || r.tax_rate_type === '3.3' || r.tax_rate_type === '8.8')
    .reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);

  // 박경수님 요청 — 견적 합계 (제안)
  const proposalTotal = ((estimateRes.data ?? []) as Array<{ total_amount: number | string | null }>)
    .reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

  const expenseTotal = legacyExpense + payrollTotal;
  const pendingExpenseTotal = legacyPending + payrollPending;
  // 박경수님 + SkyClaw 2026-05-26 — 전체 사업비 = 모든 계약금액 합.
  // 박경수님 보고 fix (STEP-FINANCE-SUMMARY-FIX 2026-05-27) — 순지출 = 지출 - 부가세 - 원천세
  //   기존: netExpense = expenseTotal - vatAmount (원천세 누락 → 인건비 환경에서 netExpense==expenseTotal 버그)
  //   변경: 부가세 + 원천세 둘 다 차감. 박경수님 환경 운영비 0건일 때도 인건비 원천세 정상 반영
  const contractTotal = contractRows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const netExpense = expenseTotal - vatAmount - withholdingTax;
  // 박경수님 + SkyClaw STEP-FINANCE-LABEL-VAT — 매출세액 (vat_type='과세' 인 행만, 포함가 역산)
  const salesVat = contractRows
    .filter((r) => r.vat_type === '과세')
    .reduce((s, r) => s + Math.floor(Number(r.contract_amount ?? 0) / 11), 0);
  const vatPayable = Math.max(0, salesVat - vatAmount);
  const remaining = budget - expenseTotal;
  const settledPct = budget > 0 ? Math.min(100, Math.round((incomeTotal / budget) * 100)) : 0;

  return { budget, contractTotal, incomeTotal, expectedIncomeTotal, expenseTotal, pendingExpenseTotal, paidExpenseTotal, payrollTotal, proposalTotal, outsourceTotal, operationTotal, vatAmount, withholdingTax, netExpense, salesVat, vatPayable, remaining, settledPct };
}

/** 참여자 미리보기 — project_members 카운트 + 최근 등록 N명 이름 */
export async function fetchProjectMembersPreview(
  projectId: string,
  limit = 4,
): Promise<ProjectMembersPreview> {
  const { data, error, count } = await supabase
    .from('project_members')
    .select('id, profile:profiles(id,name)', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[project-detail] 참여자 조회 실패:', error.message);
    return { totalCount: 0, recentNames: [] };
  }

  type Row = { id: string; profile: { id: string; name: string } | { id: string; name: string }[] | null };
  const rows = (data as Row[] | null) ?? [];
  const recentNames = rows
    .map((r) => (Array.isArray(r.profile) ? r.profile[0]?.name : r.profile?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return { totalCount: count ?? rows.length, recentNames };
}

/** 이벤트 통합 — 이 프로젝트에 묶인 programs + schedule_events */
export async function fetchProjectEvents(projectId: string): Promise<ProjectEventsBundle> {
  const [programsRes, schedulesRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, type, status, start_date, end_date, venue')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true }),
    supabase
      .from('schedule_events')
      .select('id, title, event_date, start_time, all_day, category')
      .eq('project_id', projectId)
      .order('event_date', { ascending: true }),
  ]);

  if (programsRes.error) console.error('[project-detail] 프로그램 조회 실패:', programsRes.error.message);
  // schedule_events 미적용 환경 → 빈 배열 안전 fallback (콘솔 노이즈 X)
  if (schedulesRes.error && !isMissingTableError(schedulesRes.error.message)) {
    console.error('[project-detail] 일정 조회 실패:', schedulesRes.error.message);
  }

  return {
    programs: (programsRes.data as ProjectEventsBundle['programs'] | null) ?? [],
    schedules: (schedulesRes.data as ProjectEventsBundle['schedules'] | null) ?? [],
  };
}

/** 활동 로그 — activity_logs.project_id 최근 N개 */
export async function fetchProjectActivities(projectId: string, limit = 8): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, log_type, title, activity_date, duration_hours, attendee_count')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('activity_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[project-detail] 활동 로그 조회 실패:', error.message);
    return [];
  }

  return (data as ActivityRow[] | null) ?? [];
}

// ─── 프로그램 흐름도 (STEP-PROJECT-FLOW / 2026-05-09 신규) ─

export interface FlowProgram {
  id: string;
  name: string;
  program_type: string | null;
  display_order: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export type FlowSortKey = 'display_order' | 'name' | 'created_at' | 'end_date';

export const FLOW_SORT_OPTIONS: { value: FlowSortKey; label: string }[] = [
  { value: 'display_order', label: '지정 순서' },
  { value: 'name',          label: '가나다순' },
  { value: 'created_at',    label: '생성일순' },
  { value: 'end_date',      label: '종료일순' },
];

export async function fetchProjectPrograms(projectId: string): Promise<FlowProgram[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, program_type, display_order, status, start_date, end_date, created_at')
    .eq('project_id', projectId);
  if (error) {
    console.error('[project-flow] 프로그램 목록 조회 실패:', error.message);
    return [];
  }
  return (data as FlowProgram[] | null) ?? [];
}

export function sortPrograms(programs: FlowProgram[], key: FlowSortKey): FlowProgram[] {
  return [...programs].sort((a, b) => {
    if (key === 'display_order') {
      const oa = a.display_order ?? 999;
      const ob = b.display_order ?? 999;
      if (oa !== ob) return oa - ob;
      return (a.start_date ?? '').localeCompare(b.start_date ?? '');
    }
    if (key === 'name') return (a.name ?? '').localeCompare(b.name ?? '', 'ko');
    if (key === 'created_at') return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    if (key === 'end_date') return (a.end_date ?? '9999').localeCompare(b.end_date ?? '9999');
    return 0;
  });
}

/** 완료 판별 — V2 ProgramStatus '완료' + 안전 fallback (종료/done/completed) */
export function isProgramDone(status: string | null | undefined): boolean {
  if (!status) return false;
  return ['완료', '종료', 'done', 'completed'].includes(status);
}
