// bal24 v2 — 재무 리포트 메인 페이지 (STEP 20)
// 자체사업/컨소시엄 탭 + 연도 선택 + KPI/차트/목록 (커스터마이징 레이아웃)

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  Settings,
  Save,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateKo } from '../../lib/utils';
import type { LedgerType } from '../../types/database';
import {
  fetchSummary,
  fetchMonthly,
  fetchExpenseByAccount,
  fetchUnpaidExpenses,
  fetchLayout,
  saveLayout,
  formatAmount,
  getYearOptions,
  DEFAULT_LAYOUT,
  type ReportSummary,
  type MonthlyData,
  type AccountExpense,
  type UnpaidExpense,
  type LayoutItem,
  type LayoutItemKey,
} from './financialReportUtils';
import ReportSummaryCard from './ReportSummaryCard';
import ReportBarChart from './ReportBarChart';
import ReportDonutChart from './ReportDonutChart';
import ReportLayoutEditor from './ReportLayoutEditor';

const LEDGER_TABS: Array<{ value: LedgerType; label: string }> = [
  { value: 'own', label: '자체사업' },
  { value: 'consortium', label: '컨소시엄' },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const yearOptions = useMemo(() => getYearOptions(), []);
  const currentYear = new Date().getFullYear();

  const [ledger, setLedger] = useState<LedgerType>('own');
  const [year, setYear] = useState<number>(currentYear);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [accounts, setAccounts] = useState<AccountExpense[]>([]);
  const [unpaid, setUnpaid] = useState<UnpaidExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [draftLayout, setDraftLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [savingLayout, setSavingLayout] = useState(false);

  // 데이터 로드 — ledger·year 변경 시 재조회
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [s, m, a, u] = await Promise.all([
          fetchSummary(year, ledger),
          fetchMonthly(year, ledger),
          fetchExpenseByAccount(year, ledger),
          fetchUnpaidExpenses(ledger, 5),
        ]);
        if (cancelled) return;
        setSummary(s);
        setMonthly(m);
        setAccounts(a);
        setUnpaid(u);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[reports] 데이터 로드 실패:', raw);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ledger, year]);

  // 레이아웃 로드 — user·ledger 변경 시
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const next = await fetchLayout(user.id, ledger);
      if (cancelled) return;
      setLayout(next);
      setDraftLayout(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, ledger]);

  const startEdit = () => {
    setDraftLayout(layout);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraftLayout(layout);
    setEditing(false);
  };

  const saveLayoutAndExit = useCallback(async () => {
    if (!user) return;
    setSavingLayout(true);
    const ok = await saveLayout(user.id, ledger, draftLayout);
    if (ok) {
      setLayout(draftLayout);
      setEditing(false);
    }
    setSavingLayout(false);
  }, [user, ledger, draftLayout]);

  const visibleItems = useMemo(
    () => layout.filter((i) => i.visible).sort((a, b) => a.order - b.order),
    [layout],
  );

  function renderItem(key: LayoutItemKey) {
    if (loading) {
      return (
        <div
          key={key}
          className="rounded-2xl border border-violet-100 bg-white p-6 animate-pulse h-[120px]"
          aria-hidden="true"
        />
      );
    }
    const s = summary;
    switch (key) {
      case 'kpi_income':
        return (
          <ReportSummaryCard
            key={key}
            label="총 수입"
            value={s ? formatAmount(s.totalIncome) : '-'}
            sub={`${year}년 ${ledger === 'own' ? '자체' : '컨소시엄'} 합계`}
            tone="violet"
            icon={<TrendingUp size={16} aria-hidden="true" />}
          />
        );
      case 'kpi_expense':
        return (
          <ReportSummaryCard
            key={key}
            label="총 지출"
            value={s ? formatAmount(s.totalExpense) : '-'}
            sub={`미지급 ${s?.unpaidExpenseCount ?? 0}건`}
            tone="orange"
            icon={<TrendingDown size={16} aria-hidden="true" />}
          />
        );
      case 'kpi_net': {
        const net = s?.netProfit ?? 0;
        return (
          <ReportSummaryCard
            key={key}
            label="순이익"
            value={s ? formatAmount(net) : '-'}
            sub={net < 0 ? '⚠ 적자' : '흑자'}
            tone={net < 0 ? 'red' : 'green'}
            icon={<Wallet size={16} aria-hidden="true" />}
          />
        );
      }
      case 'kpi_project':
        return (
          <ReportSummaryCard
            key={key}
            label="진행 중 프로젝트"
            value={s ? `${s.projectCount}건` : '-'}
            sub="전체 (자체+컨소시엄)"
            tone="mint"
            icon={<Briefcase size={16} aria-hidden="true" />}
          />
        );
      case 'chart_bar':
        return (
          <section
            key={key}
            className="col-span-full rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]"
          >
            <h2 className="text-sm font-bold text-[#1E1B4B] mb-3">📈 월별 수입·지출</h2>
            <ReportBarChart data={monthly} />
          </section>
        );
      case 'chart_donut':
        return (
          <section
            key={key}
            className="col-span-1 sm:col-span-2 rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]"
          >
            <h2 className="text-sm font-bold text-[#1E1B4B] mb-3">🍩 계정과목별 지출</h2>
            <ReportDonutChart data={accounts} />
          </section>
        );
      case 'list_unpaid':
        return (
          <section
            key={key}
            className="col-span-1 sm:col-span-2 rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2"
          >
            <h2 className="text-sm font-bold text-[#1E1B4B]">📋 미지급 지출 (상위 5건)</h2>
            {unpaid.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">미지급 지출이 없어요.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {unpaid.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 py-2.5 text-sm">
                    <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 shrink-0">
                      {u.account_label}
                    </span>
                    <span className="flex-1 truncate text-slate-700">{u.description ?? '설명 없음'}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-orange-700">
                      {formatAmount(u.gross_amount)}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDateKo(u.expense_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">📊</span>
          재무 리포트
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
            {LEDGER_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setLedger(t.value)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                  ledger === t.value ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-violet-100 bg-white px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={savingLayout}>
                <XCircle size={16} className="mr-1.5" aria-hidden="true" />
                취소
              </Button>
              <Button variant="primary" onClick={() => void saveLayoutAndExit()} loading={savingLayout}>
                <Save size={16} className="mr-1.5" aria-hidden="true" />
                저장하기
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEdit}>
              <Settings size={16} className="mr-1.5" aria-hidden="true" />
              편집
            </Button>
          )}
        </div>
      </header>

      {editing ? (
        <ReportLayoutEditor layout={draftLayout} onChange={setDraftLayout} />
      ) : (
        <>
          {loading && (
            <div className="rounded-2xl border border-violet-100 bg-white p-6 flex items-center justify-center">
              <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
            </div>
          )}

          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-violet-100 bg-white p-12 text-center text-sm text-slate-500">
              표시할 항목이 없어요. [편집] 버튼으로 항목을 추가해 주세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleItems.map((item) => renderItem(item.key))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
