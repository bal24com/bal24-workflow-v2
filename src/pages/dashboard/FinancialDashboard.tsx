// 홈 하단 전체 재무 대시보드 — 박경수님 + SkyClaw 2026-05-26
// 박경수님 환경 컬럼 매핑:
//  - 전체 사업비: projects.budget 합계 (견적 확정 [견적내용 계약진행] 시 자동 설정)
//  - 입금완료: income_contracts.deposited_at 채워진 행의 contract_amount 합
//  - 지출: payroll_expenses (project_id OR 연결된 program_id 양쪽 매칭)
//  - 부가세/원천세: payroll_expenses.tax_amount 의 운영비/인건비 분리

import { useCallback, useEffect, useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { isPersonCategory } from '../payroll/payrollUtils';

interface DashboardFilter {
  dateFrom: string;
  dateTo: string;
  projectIds: string[];
}

interface DashboardSummary {
  businessTotal: number;       // 전체 사업비 (projects.budget 합)
  contractTotal: number;       // 계약 등록 금액 (income_contracts.contract_amount 합)
  receivedTotal: number;       // 입금 완료 (deposited_at 채워진 행)
  expenseTotal: number;        // 지출 합계 (payroll_expenses.subtotal)
  vatTotal: number;
  withholdingTotal: number;
  netExpenseTotal: number;
  remainingTotal: number;
  executionRate: number;       // 집행률 (%)
  projectCount: number;
}

interface ProjectOption { id: string; name: string; budget: number | null }

const EMPTY_SUMMARY: DashboardSummary = {
  businessTotal: 0, contractTotal: 0, receivedTotal: 0, expenseTotal: 0,
  vatTotal: 0, withholdingTotal: 0, netExpenseTotal: 0,
  remainingTotal: 0, executionRate: 0, projectCount: 0,
};

async function fetchDashboardSummary(filter: DashboardFilter): Promise<DashboardSummary> {
  // 1) projects.budget — 전체 사업비 (견적 확정 시 자동 설정)
  let prjQ = supabase.from('projects').select('id, budget').is('deleted_at', null);
  if (filter.projectIds.length > 0) prjQ = prjQ.in('id', filter.projectIds);
  const prjRes = await prjQ;
  if (prjRes.error) console.error('[FinancialDashboard] projects 조회 실패:', prjRes.error.message);
  const prjRows = (prjRes.data ?? []) as Array<{ id: string; budget: number | string | null }>;
  const businessTotal = prjRows.reduce((s, r) => s + Number(r.budget ?? 0), 0);
  const activeProjectIds = prjRows.map((r) => r.id);

  // 2) programs — 해당 프로젝트에 묶인 program_id 수집 (payroll 양방향 매칭용)
  let prgQ = supabase.from('programs').select('id, project_id').is('deleted_at', null);
  if (activeProjectIds.length > 0) prgQ = prgQ.in('project_id', activeProjectIds);
  const prgRes = await prgQ;
  if (prgRes.error) console.error('[FinancialDashboard] programs 조회 실패:', prgRes.error.message);
  const programIds = ((prgRes.data ?? []) as Array<{ id: string }>).map((p) => p.id);

  // 3) income_contracts — 계약 금액 + 입금 완료 (deposited_at 채워진 것)
  let conQ = supabase.from('income_contracts')
    .select('contract_amount, deposited_at, tax_invoice_url, project_id, program_id')
    .is('deleted_at', null);
  if (activeProjectIds.length > 0) {
    // project_id 직접 OR 연결된 program_id
    if (programIds.length > 0) {
      conQ = conQ.or(`project_id.in.(${activeProjectIds.join(',')}),program_id.in.(${programIds.join(',')})`);
    } else {
      conQ = conQ.in('project_id', activeProjectIds);
    }
  }
  const conRes = await conQ;
  if (conRes.error) console.error('[FinancialDashboard] contracts 조회 실패:', conRes.error.message);
  const conRows = (conRes.data ?? []) as Array<{ contract_amount: number | string | null; deposited_at: string | null; tax_invoice_url: string | null; project_id: string | null }>;
  const contractTotal = conRows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  // 입금 완료 = deposited_at 채워진 행. (세금계산서 발행 여부는 tax_invoice_url 로 추가 판정 가능하지만 박경수님 환경에선 deposited_at 단독이 명확)
  const receivedTotal = conRows.filter((r) => r.deposited_at).reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);

  // 4) payroll_expenses — project_id OR program_id 양쪽 매칭 (박경수님 환경 견적이 project_id 만 채워진 경우 보강)
  let expQ = supabase.from('payroll_expenses')
    .select('subtotal, tax_amount, tax_rate_type, expense_type, project_id, program_id, paid_at, created_at')
    .is('deleted_at', null);
  if (activeProjectIds.length > 0) {
    if (programIds.length > 0) {
      expQ = expQ.or(`project_id.in.(${activeProjectIds.join(',')}),program_id.in.(${programIds.join(',')})`);
    } else {
      expQ = expQ.in('project_id', activeProjectIds);
    }
  }
  const expRes = await expQ;
  if (expRes.error) console.error('[FinancialDashboard] payroll 조회 실패:', expRes.error.message);
  let rows = (expRes.data ?? []) as Array<{ subtotal: number | string | null; tax_amount: number | string | null; tax_rate_type: string | null; expense_type: string; project_id: string | null; paid_at: string | null; created_at: string }>;
  // 기간 필터 (paid_at null → created_at fallback)
  if (filter.dateFrom || filter.dateTo) {
    rows = rows.filter((r) => {
      const d = r.paid_at ?? r.created_at;
      if (filter.dateFrom && d < filter.dateFrom) return false;
      if (filter.dateTo && d > filter.dateTo) return false;
      return true;
    });
  }

  const expenseTotal = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  // 박경수님 보고 fix — isPersonCategory 한글 키워드 매칭으로 통일
  const vatTotal = rows.filter((r) => !isPersonCategory(r.expense_type))
    .reduce((s, r) => {
      const stored = Number(r.tax_amount ?? 0);
      return s + (stored > 0 ? stored : Math.floor(Number(r.subtotal ?? 0) / 11));
    }, 0);
  const withholdingTotal = rows.filter((r) => isPersonCategory(r.expense_type))
    .reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  const netExpenseTotal = expenseTotal - vatTotal;
  // 박경수님 + SkyClaw — 잔여·집행률 기준은 businessTotal(견적 확정 budget). 없으면 contractTotal fallback.
  const baseTotal = businessTotal > 0 ? businessTotal : contractTotal;
  const remainingTotal = baseTotal - expenseTotal;
  const executionRate = baseTotal > 0 ? Math.round((expenseTotal / baseTotal) * 100) : 0;
  const projectCount = activeProjectIds.length;

  return { businessTotal, contractTotal, receivedTotal, expenseTotal, vatTotal, withholdingTotal, netExpenseTotal, remainingTotal, executionRate, projectCount };
}

export default function FinancialDashboard() {
  const [filter, setFilter] = useState<DashboardFilter>({ dateFrom: '', dateTo: '', projectIds: [] });
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async (f: DashboardFilter) => {
    setLoading(true);
    try {
      const res = await fetchDashboardSummary(f);
      setSummary(res);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase.from('projects').select('id, name, budget').is('deleted_at', null).order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[FinancialDashboard] projects 조회 실패:', error.message);
        setProjects((data ?? []) as ProjectOption[]);
      });
    void loadSummary(filter);
    return () => { cancelled = true; };
  // 최초 1회만 (filter 변화는 [조회] 버튼으로 트리거)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetFilter() {
    const next: DashboardFilter = { dateFrom: '', dateTo: '', projectIds: [] };
    setFilter(next);
    void loadSummary(next);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <header className="flex items-center gap-2">
        <BarChart3 size={18} className="text-violet-600" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800">전체 재무 현황</h3>
        <span className="ml-auto text-[11px] text-slate-400">{summary.projectCount}개 프로젝트 집계</span>
      </header>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="block text-[11px] text-slate-500">시작일</label>
          <input type="date" value={filter.dateFrom} onChange={(e) => setFilter((p) => ({ ...p, dateFrom: e.target.value }))}
            className="h-8 border border-slate-200 rounded-lg px-2 text-xs" />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] text-slate-500">종료일</label>
          <input type="date" value={filter.dateTo} onChange={(e) => setFilter((p) => ({ ...p, dateTo: e.target.value }))}
            className="h-8 border border-slate-200 rounded-lg px-2 text-xs" />
        </div>
        <div className="space-y-1 min-w-[200px]">
          <label className="block text-[11px] text-slate-500">프로젝트 ({filter.projectIds.length === 0 ? '전체' : `${filter.projectIds.length}개`})</label>
          <select multiple value={filter.projectIds}
            onChange={(e) => setFilter((p) => ({ ...p, projectIds: Array.from(e.target.selectedOptions, (o) => o.value) }))}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-full max-h-20">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => void loadSummary(filter)} disabled={loading}
          className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        <button type="button" onClick={resetFilter}
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
          초기화
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mr-1.5" /> 불러오는 중…
        </div>
      ) : (
        <>
          {/* 4분할 카드 — 박경수님 보고 fix: businessTotal(projects.budget) 기준 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <SummaryCard label="전체 사업비" icon="💼" value={summary.businessTotal}
              sub={summary.businessTotal === 0 && summary.contractTotal > 0
                ? `(계약 ${formatMoney(summary.contractTotal)} 기준)`
                : `${summary.projectCount}개 프로젝트`}
              color="violet" />
            <SummaryCard label="수입 (입금완료)" icon="📥" value={summary.receivedTotal}
              sub={summary.businessTotal > 0
                ? `수금률 ${Math.round(summary.receivedTotal / summary.businessTotal * 100)}%`
                : (summary.contractTotal > 0 ? `계약 대비 ${Math.round(summary.receivedTotal / summary.contractTotal * 100)}%` : '계약 미등록')}
              color="emerald" />
            <SummaryCard label="지출 합계" icon="📤" value={summary.expenseTotal}
              sub={`집행률 ${summary.executionRate}%`} color="amber" />
            <SummaryCard label={summary.remainingTotal < 0 ? '예산 초과 ⚠' : '잔여 예산'} icon={summary.remainingTotal < 0 ? '⚠' : '💰'}
              value={Math.abs(summary.remainingTotal)} sub={summary.remainingTotal < 0 ? '초과 집행' : '사용 가능'}
              color={summary.remainingTotal < 0 ? 'rose' : 'slate'} />
          </div>
          {/* 세액 분리 행 */}
          <div className="bg-slate-50 rounded-lg px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-slate-500 mb-0.5">순지출 (세액 제외)</p>
              <p className="font-bold text-slate-700 tabular-nums">{formatMoney(summary.netExpenseTotal)}</p>
            </div>
            <div>
              <p className="text-amber-600 mb-0.5">부가세 (운영비 포함분)</p>
              <p className="font-bold text-amber-700 tabular-nums">{formatMoney(summary.vatTotal)}</p>
            </div>
            <div>
              <p className="text-orange-600 mb-0.5">원천세 (인건비)</p>
              <p className="font-bold text-orange-700 tabular-nums">{formatMoney(summary.withholdingTotal)}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const COLORS: Record<'violet' | 'emerald' | 'amber' | 'rose' | 'slate', string> = {
  violet:  'bg-violet-50 text-violet-700 border-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber:   'bg-amber-50 text-amber-700 border-amber-100',
  rose:    'bg-rose-50 text-rose-700 border-rose-200',
  slate:   'bg-slate-50 text-slate-700 border-slate-100',
};

function SummaryCard({ label, icon, value, sub, color }: {
  label: string; icon: string; value: number; sub: string;
  color: keyof typeof COLORS;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${COLORS[color]}`}>
      <p className="text-[11px] opacity-80 mb-0.5">{icon} {label}</p>
      <p className="text-base font-bold tabular-nums">{formatMoney(value)}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}
