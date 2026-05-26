// 홈 하단 전체 재무 대시보드 — 박경수님 + SkyClaw STEP-FINANCE-DASHBOARD-UI (2026-05-27)
// 변경: 연도 선택 탭 + 프로젝트 팝업 모달 + 2단 레이아웃 (상단 전체 / 하단 선택 프로젝트 상세)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, BarChart3, FolderOpen, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { isPersonCategory } from '../payroll/payrollUtils';
import YearSelector from './YearSelector';
import ProjectSelectModal from './ProjectSelectModal';
import ProjectFinanceDetail from './ProjectFinanceDetail';

interface DashboardFilter { dateFrom: string; dateTo: string; projectId: string | null }

interface DashboardSummary {
  businessTotal: number; contractTotal: number; receivedTotal: number;
  expenseTotal: number; vatTotal: number; withholdingTotal: number;
  netExpenseTotal: number; remainingTotal: number; executionRate: number; projectCount: number;
}

interface ProjectOption { id: string; name: string; budget: number | null }

const EMPTY_SUMMARY: DashboardSummary = { businessTotal: 0, contractTotal: 0, receivedTotal: 0, expenseTotal: 0, vatTotal: 0, withholdingTotal: 0, netExpenseTotal: 0, remainingTotal: 0, executionRate: 0, projectCount: 0 };

async function fetchDashboardSummary(filter: DashboardFilter): Promise<DashboardSummary> {
  // 1) projects.budget
  let prjQ = supabase.from('projects').select('id, budget').is('deleted_at', null);
  if (filter.projectId) prjQ = prjQ.eq('id', filter.projectId);
  const prjRes = await prjQ;
  if (prjRes.error) console.error('[FinancialDashboard] projects 조회 실패:', prjRes.error.message);
  const prjRows = (prjRes.data ?? []) as Array<{ id: string; budget: number | string | null }>;
  const businessTotal = prjRows.reduce((s, r) => s + Number(r.budget ?? 0), 0);
  const activeProjectIds = prjRows.map((r) => r.id);

  // 2) programs — 양방향 매칭용 id 수집
  let prgQ = supabase.from('programs').select('id').is('deleted_at', null);
  if (activeProjectIds.length > 0) prgQ = prgQ.in('project_id', activeProjectIds);
  const prgRes = await prgQ;
  const programIds = ((prgRes.data ?? []) as Array<{ id: string }>).map((p) => p.id);

  // 3) income_contracts
  let conQ = supabase.from('income_contracts').select('contract_amount, deposited_at, project_id').is('deleted_at', null);
  if (activeProjectIds.length > 0) {
    conQ = programIds.length > 0
      ? conQ.or(`project_id.in.(${activeProjectIds.join(',')}),program_id.in.(${programIds.join(',')})`)
      : conQ.in('project_id', activeProjectIds);
  }
  const conRes = await conQ;
  const conRows = (conRes.data ?? []) as Array<{ contract_amount: number | string | null; deposited_at: string | null }>;
  const contractTotal = conRows.reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);
  const receivedTotal = conRows.filter((r) => r.deposited_at).reduce((s, r) => s + Number(r.contract_amount ?? 0), 0);

  // 4) payroll_expenses
  let expQ = supabase.from('payroll_expenses').select('subtotal, tax_amount, tax_rate_type, expense_type, project_id, program_id, paid_at, created_at').is('deleted_at', null);
  if (activeProjectIds.length > 0) {
    expQ = programIds.length > 0
      ? expQ.or(`project_id.in.(${activeProjectIds.join(',')}),program_id.in.(${programIds.join(',')})`)
      : expQ.in('project_id', activeProjectIds);
  }
  const expRes = await expQ;
  let rows = (expRes.data ?? []) as Array<{ subtotal: number | string | null; tax_amount: number | string | null; tax_rate_type: string | null; expense_type: string; paid_at: string | null; created_at: string }>;
  if (filter.dateFrom || filter.dateTo) {
    rows = rows.filter((r) => {
      const d = r.paid_at ?? r.created_at;
      if (filter.dateFrom && d < filter.dateFrom) return false;
      if (filter.dateTo && d > filter.dateTo) return false;
      return true;
    });
  }

  const expenseTotal = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
  const vatTotal = rows.filter((r) => !isPersonCategory(r.expense_type))
    .reduce((s, r) => { const stored = Number(r.tax_amount ?? 0); return s + (stored > 0 ? stored : Math.floor(Number(r.subtotal ?? 0) / 11)); }, 0);
  const withholdingTotal = rows.filter((r) => isPersonCategory(r.expense_type)).reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
  // 박경수님 + SkyClaw STEP-FINANCE-SUMMARY-FIX (2026-05-27) — 순지출 = 지출 - 부가세 - 원천세
  const netExpenseTotal = expenseTotal - vatTotal - withholdingTotal;
  const baseTotal = businessTotal > 0 ? businessTotal : contractTotal;
  const remainingTotal = baseTotal - expenseTotal;
  const executionRate = baseTotal > 0 ? Math.round((expenseTotal / baseTotal) * 100) : 0;
  return { businessTotal, contractTotal, receivedTotal, expenseTotal, vatTotal, withholdingTotal, netExpenseTotal, remainingTotal, executionRate, projectCount: activeProjectIds.length };
}

export default function FinancialDashboard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async (f: DashboardFilter) => {
    setLoading(true);
    try { setSummary(await fetchDashboardSummary(f)); } finally { setLoading(false); }
  }, []);

  // 연도 선택 → 날짜 범위 자동 적용
  function applyYearFilter(year: number | null) {
    setSelectedYear(year);
    const from = year === null ? '' : `${year}-01-01`;
    const to = year === null ? '' : `${year}-12-31`;
    setDateFrom(from); setDateTo(to);
    void loadSummary({ dateFrom: from, dateTo: to, projectId: selectedProjectId });
  }
  function handleDateChange(field: 'from' | 'to', value: string) {
    setSelectedYear(null); // 직접 변경 시 연도 탭 해제
    const newFrom = field === 'from' ? value : dateFrom;
    const newTo = field === 'to' ? value : dateTo;
    if (field === 'from') setDateFrom(value); else setDateTo(value);
    void loadSummary({ dateFrom: newFrom, dateTo: newTo, projectId: selectedProjectId });
  }
  function handleProjectChange(id: string | null) {
    setSelectedProjectId(id);
    void loadSummary({ dateFrom, dateTo, projectId: id });
  }
  function handleReset() {
    setSelectedYear(currentYear); setDateFrom(`${currentYear}-01-01`); setDateTo(`${currentYear}-12-31`); setSelectedProjectId(null);
    void loadSummary({ dateFrom: `${currentYear}-01-01`, dateTo: `${currentYear}-12-31`, projectId: null });
  }

  useEffect(() => {
    let cancelled = false;
    void supabase.from('projects').select('id, name, budget').is('deleted_at', null).order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[FinancialDashboard] projects 조회 실패:', error.message);
        setProjects((data ?? []) as ProjectOption[]);
      });
    void loadSummary({ dateFrom, dateTo, projectId: null });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProjectName = selectedProjectId ? (projects.find((p) => p.id === selectedProjectId)?.name ?? '프로젝트') : null;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <header className="flex items-center gap-2">
        <BarChart3 size={18} className="text-violet-600" aria-hidden="true" />
        <h3 className="text-base font-bold text-slate-800">전체 재무 현황</h3>
      </header>

      {/* 필터 — 연도 탭 + 날짜 + 프로젝트 팝업 + 초기화 */}
      <div className="flex flex-wrap items-center gap-2">
        <YearSelector selectedYear={selectedYear} onChange={applyYearFilter} />
        <div className="inline-flex items-center gap-1 text-xs">
          <input type="date" value={dateFrom} onChange={(e) => handleDateChange('from', e.target.value)}
            className="h-8 border border-slate-200 rounded-lg px-2" />
          <span className="text-slate-400">~</span>
          <input type="date" value={dateTo} onChange={(e) => handleDateChange('to', e.target.value)}
            className="h-8 border border-slate-200 rounded-lg px-2" />
        </div>
        <button type="button" onClick={() => setProjectModalOpen(true)}
          className="inline-flex items-center gap-1 h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-violet-400">
          <span>{selectedProjectName ?? '전체 프로젝트'}</span>
          <ChevronDown size={12} className="text-slate-400" aria-hidden="true" />
        </button>
        <button type="button" onClick={handleReset}
          className="h-8 px-3 rounded-lg text-xs text-slate-500 hover:text-slate-700">초기화</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…
        </div>
      ) : (
        <>
          {/* 상단 — 전체(또는 연도) 합계 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-700">{selectedYear ? `${selectedYear}년 전체 현황` : '전체 기간 현황'}</h4>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{summary.projectCount}개 프로젝트</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <Card label="전체 사업비" icon="💼" value={summary.businessTotal}
                sub={summary.businessTotal === 0 && summary.contractTotal > 0 ? `(계약 ${formatMoney(summary.contractTotal)} 기준)` : `${summary.projectCount}개 프로젝트`}
                color="violet" />
              <Card label="수입 (입금완료)" icon="📥" value={summary.receivedTotal}
                sub={summary.businessTotal > 0 ? `수금률 ${Math.round(summary.receivedTotal / summary.businessTotal * 100)}%` : (summary.contractTotal > 0 ? `계약 대비 ${Math.round(summary.receivedTotal / summary.contractTotal * 100)}%` : '계약 미등록')}
                color="emerald" />
              <Card label="지출 합계" icon="📤" value={summary.expenseTotal} sub={`집행률 ${summary.executionRate}%`} color="amber" />
              <Card label={summary.remainingTotal < 0 ? '예산 초과 ⚠' : '잔여 예산'} icon={summary.remainingTotal < 0 ? '⚠' : '💰'}
                value={Math.abs(summary.remainingTotal)} sub={summary.remainingTotal < 0 ? '초과 집행' : '사용 가능'}
                color={summary.remainingTotal < 0 ? 'rose' : 'slate'} />
            </div>
            <div className="bg-slate-50 rounded-lg px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div><p className="text-slate-500 mb-0.5">순지출 (세액 제외)</p><p className="font-bold text-slate-700 tabular-nums">{formatMoney(summary.netExpenseTotal)}</p></div>
              <div><p className="text-amber-600 mb-0.5">부가세 (운영비 포함분)</p><p className="font-bold text-amber-700 tabular-nums">{formatMoney(summary.vatTotal)}</p></div>
              <div><p className="text-orange-600 mb-0.5">원천세 (인건비)</p><p className="font-bold text-orange-700 tabular-nums">{formatMoney(summary.withholdingTotal)}</p></div>
            </div>
          </div>

          <div className="border-t border-slate-200 my-2" />

          {/* 하단 — 선택 프로젝트 상세 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-slate-700">프로젝트 상세</h4>
              {selectedProjectName && <span className="text-[10px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full font-semibold">{selectedProjectName}</span>}
            </div>
            {selectedProjectId === null ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <FolderOpen size={28} className="opacity-40 mb-2" aria-hidden="true" />
                <p className="text-xs">프로젝트를 선택하면 상세 내역이 표시돼요.</p>
                <button type="button" onClick={() => setProjectModalOpen(true)} className="mt-2 text-xs text-violet-600 hover:underline">
                  프로젝트 선택하기 →
                </button>
              </div>
            ) : (
              <ProjectFinanceDetail projectId={selectedProjectId} startDate={dateFrom || null} endDate={dateTo || null} />
            )}
          </div>
        </>
      )}

      <ProjectSelectModal open={projectModalOpen} projects={projects} selectedId={selectedProjectId}
        onSelect={handleProjectChange} onClose={() => setProjectModalOpen(false)} />
    </section>
  );
}

const COLORS: Record<'violet' | 'emerald' | 'amber' | 'rose' | 'slate', string> = {
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-100',
};

function Card({ label, icon, value, sub, color }: { label: string; icon: string; value: number; sub: string; color: keyof typeof COLORS }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${COLORS[color]}`}>
      <p className="text-[11px] opacity-80 mb-0.5">{icon} {label}</p>
      <p className="text-base font-bold tabular-nums">{formatMoney(value)}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}
