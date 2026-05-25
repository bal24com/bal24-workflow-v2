// 홈 하단 전체 재무 대시보드 — 박경수님 + SkyClaw 2026-05-26
// 기간·프로젝트 필터 + 전체 사업비/지출/세액 분리 카드.
// 박경수님 환경 컬럼 매핑: gross_amount → subtotal, vat_amount → tax_amount(운영비)
// payment_category → expense_type prefix (isOutsourceType/isOperationType)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { isOutsourceType, isOperationType } from '../payroll/payrollUtils';

interface DashboardFilter {
  dateFrom: string;
  dateTo: string;
  projectIds: string[];
}

interface DashboardSummary {
  contractTotal: number;
  receivedTotal: number;
  expenseTotal: number;
  vatTotal: number;
  withholdingTotal: number;
  netExpenseTotal: number;
  remainingTotal: number;
  projectCount: number;
}

interface ProjectOption { id: string; name: string }

const EMPTY_SUMMARY: DashboardSummary = {
  contractTotal: 0, receivedTotal: 0, expenseTotal: 0,
  vatTotal: 0, withholdingTotal: 0, netExpenseTotal: 0,
  remainingTotal: 0, projectCount: 0,
};

async function fetchDashboardSummary(filter: DashboardFilter): Promise<DashboardSummary> {
  // payroll_expenses fetch (박경수님 환경: subtotal·tax_amount·expense_type·tax_rate_type)
  let expQ = supabase.from('payroll_expenses')
    .select('subtotal, tax_amount, tax_rate_type, expense_type, project_id, paid_at, created_at')
    .is('deleted_at', null);
  if (filter.projectIds.length > 0) expQ = expQ.in('project_id', filter.projectIds);
  if (filter.dateFrom) expQ = expQ.or(`paid_at.gte.${filter.dateFrom},and(paid_at.is.null,created_at.gte.${filter.dateFrom})`);
  if (filter.dateTo)   expQ = expQ.or(`paid_at.lte.${filter.dateTo},and(paid_at.is.null,created_at.lte.${filter.dateTo})`);
  const expRes = await expQ;
  if (expRes.error) console.error('[FinancialDashboard] payroll 조회 실패:', expRes.error.message);

  // income_contracts fetch
  let conQ = supabase.from('income_contracts')
    .select('contract_amount, deposited_at, project_id')
    .is('deleted_at', null);
  if (filter.projectIds.length > 0) conQ = conQ.in('project_id', filter.projectIds);
  const conRes = await conQ;
  if (conRes.error) console.error('[FinancialDashboard] contracts 조회 실패:', conRes.error.message);

  const rows = (expRes.data ?? []) as Array<{ subtotal: number | string | null; tax_amount: number | string | null; tax_rate_type: string | null; expense_type: string; project_id: string | null }>;
  const conRows = (conRes.data ?? []) as Array<{ contract_amount: number | string | null; deposited_at: string | null; project_id: string | null }>;

  const expenseTotal = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  // 박경수님 환경: tax_amount = 운영비면 부가세, 인건비면 원천세. 운영비 0 이면 sub/11 fallback.
  const vatTotal = rows.filter((r) => isOperationType(r.expense_type) || r.tax_rate_type === '10')
    .reduce((s, r) => {
      const stored = Number(r.tax_amount ?? 0);
      return s + (stored > 0 ? stored : Math.floor(Number(r.subtotal ?? 0) / 11));
    }, 0);
  const withholdingTotal = rows.filter((r) => isOutsourceType(r.expense_type) || r.tax_rate_type === '3.3' || r.tax_rate_type === '8.8')
    .reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  const contractTotal = conRows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const receivedTotal = conRows.filter((r) => r.deposited_at).reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const netExpenseTotal = expenseTotal - vatTotal;
  const remainingTotal = contractTotal - expenseTotal;
  const projectCount = new Set([
    ...rows.map((r) => r.project_id),
    ...conRows.map((r) => r.project_id),
  ].filter(Boolean)).size;

  return { contractTotal, receivedTotal, expenseTotal, vatTotal, withholdingTotal, netExpenseTotal, remainingTotal, projectCount };
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
    void supabase.from('projects').select('id, name').is('deleted_at', null).order('name')
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
          {/* 4분할 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <SummaryCard label="전체 사업비" icon="💼" value={summary.contractTotal} sub={`${summary.projectCount}개 프로젝트`} color="violet" />
            <SummaryCard label="총 수입 (입금)" icon="📥" value={summary.receivedTotal}
              sub={summary.contractTotal > 0 ? `수금률 ${Math.round(summary.receivedTotal / summary.contractTotal * 100)}%` : '—'} color="emerald" />
            <SummaryCard label="지출 합계" icon="📤" value={summary.expenseTotal}
              sub={`집행률 ${summary.contractTotal > 0 ? Math.round(summary.expenseTotal / summary.contractTotal * 100) : 0}%`} color="amber" />
            <SummaryCard label={summary.remainingTotal < 0 ? '예산 초과' : '잔여 예산'} icon={summary.remainingTotal < 0 ? '⚠' : '💰'}
              value={Math.abs(summary.remainingTotal)} sub={summary.remainingTotal < 0 ? '계약금액 초과' : '사용 가능'}
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
