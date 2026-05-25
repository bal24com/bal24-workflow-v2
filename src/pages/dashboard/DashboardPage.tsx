// bal24 v2 — 대시보드 메인 (V7 → V2 이식: 단계별·태스크 알림·빠른 액션 통합)
// KPI 6개 (수입 전월 변화율 포함) + 인사말 + 단계별 진행 + 태스크 알림 + 최근 지출 + 빠른 액션

import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';
import {
  Briefcase, GraduationCap, TrendingUp, Wallet,
  Calendar, AlertTriangle,
  ArrowUp, ArrowDown, Minus, Loader2, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { findExpenseCode } from '../../utils/accounting';
import {
  fetchDashboardKpis,
  fetchRecentExpenses,
  computeChangeRate,
  type DashboardKpis,
  type RecentExpense,
} from './dashboardUtils';
import GreetingHeader from './components/GreetingHeader';
import ProjectStagePanel from './components/ProjectStagePanel';
import TaskAlertPanel from './components/TaskAlertPanel';
import QuickActionsCard from './components/QuickActionsCard';
import DashboardUrgentWidget from './components/DashboardUrgentWidget';
import PageHelpBanner from '../../components/PageHelpBanner';
// 박경수님 + SkyClaw 2026-05-26 — 홈 하단 전체 재무 대시보드
import FinancialDashboard from './FinancialDashboard';

type Tone = 'violet' | 'orange' | 'cyan' | 'emerald' | 'rose';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  Icon: LucideIcon;
  tone: Tone;
  trend?: 'up' | 'down' | 'flat';
  rate?: number;
  trendLabel?: string;
  alert?: boolean;
}

const TONE_STYLE: Record<Tone, { bg: string; text: string; ring: string }> = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-600',  ring: 'border-violet-100' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-600',  ring: 'border-orange-100' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-600',    ring: 'border-cyan-100' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'border-emerald-100' },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-600',    ring: 'border-rose-100' },
};

function TrendBadge({ trend, rate, label }: { trend: 'up' | 'down' | 'flat'; rate: number; label: string }) {
  if (trend === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
        <Minus size={12} aria-hidden="true" />
        {label} 동일
      </span>
    );
  }
  const isUp = trend === 'up';
  const color = isUp ? 'text-emerald-600' : 'text-rose-600';
  const Arrow = isUp ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Arrow size={12} aria-hidden="true" />
      {label} {rate}%
    </span>
  );
}

function KpiCard({ label, value, sub, Icon, tone, trend, rate, trendLabel, alert }: KpiCardProps) {
  const t = TONE_STYLE[tone];
  return (
    <div className={`rounded-2xl border ${t.ring} bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className={`text-2xl font-bold ${alert ? 'text-rose-600' : t.text}`}>{value}</div>
      <div className="min-h-[18px]">
        {sub && !trend && <span className="text-xs text-slate-400">{sub}</span>}
        {trend && <TrendBadge trend={trend} rate={rate ?? 0} label={trendLabel ?? '전월 대비'} />}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  // STEP-PARTNER-SIDEBAR — PARTNER 는 전용 홈으로 redirect
  const { isPartner, isLoading: partnerLoading } = usePartnerProfile();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [expenses, setExpenses] = useState<RecentExpense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [k, e] = await Promise.all([fetchDashboardKpis(), fetchRecentExpenses(5)]);
        if (cancelled) return;
        setKpis(k);
        setExpenses(e);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[dashboard] 대시보드 데이터 로드 실패:', raw);
        toast.error('대시보드 데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const incomeChange = useMemo(() => {
    if (!kpis) return null;
    return computeChangeRate(kpis.thisMonthIncome, kpis.prevMonthIncome);
  }, [kpis]);

  // STEP-PARTNER-SIDEBAR — PARTNER 로그인이면 /partner-home 으로 이동
  // 훅 호출 모두 완료된 후의 조기 반환 (Rules of Hooks 준수)
  if (!partnerLoading && isPartner) {
    return <Navigate to="/partner-home" replace />;
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🏠</span>
        홈
      </h1>

      <PageHelpBanner
        title="홈에서 할 수 있는 것"
        lines={[
          '✦ 진행 중 프로젝트·태스크·재무 현황을 한 화면에서 확인',
          '✦ 단계별 진행 패널 + 태스크 알림으로 오늘 할 일 즉시 파악',
          '💡 우측 빠른 액션 카드로 자주 쓰는 등록·이동을 한 번에',
        ]}
      />

      <GreetingHeader />

      {/* 긴급 처리 위젯 — 멘토링 일지 승인 대기·반려 미수정 (0건이면 숨김) */}
      <DashboardUrgentWidget />

      {/* KPI 6개 — 기존 4 + 오늘마감/지연 2 */}
      {loading || !kpis ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-violet-100 bg-white p-5 animate-pulse h-[126px]"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            label="진행 중 프로젝트"
            value={`${kpis.activeProjectCount}건`}
            sub="진행·정산 단계"
            Icon={Briefcase}
            tone="violet"
          />
          <KpiCard
            label="이번달 수입"
            value={formatMoney(kpis.thisMonthIncome)}
            Icon={TrendingUp}
            tone="emerald"
            trend={incomeChange?.trend}
            rate={incomeChange?.rate}
            trendLabel="전월"
          />
          <KpiCard
            label="미정산 지출"
            value={formatMoney(kpis.pendingExpenseTotal)}
            sub={`대기 ${kpis.pendingExpenseCount}건`}
            Icon={Wallet}
            tone="orange"
          />
          <KpiCard
            label="활성 프로그램"
            value={`${kpis.activeProgramCount}건`}
            sub="진행 중인 교육·캠프"
            Icon={GraduationCap}
            tone="cyan"
          />
          <KpiCard
            label="오늘 마감 태스크"
            value={`${kpis.todayDueCount}건`}
            sub={kpis.todayDueCount === 0 ? '여유 있어요 ✨' : '확인이 필요해요'}
            Icon={Calendar}
            tone="orange"
            alert={kpis.todayDueCount > 0}
          />
          <KpiCard
            label="지연 태스크"
            value={`${kpis.overdueCount}건`}
            sub={kpis.overdueCount === 0 ? '깨끗합니다 ✨' : '즉시 확인 필요'}
            Icon={AlertTriangle}
            tone="rose"
            alert={kpis.overdueCount > 0}
          />
        </div>
      )}

      {/* 진행 중 프로젝트 + 오늘·지연 할 일 — 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectStagePanel />
        <TaskAlertPanel />
      </div>

      {/* 최근 지출 + 빠른 액션 — 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
              <Wallet size={16} className="text-orange-500" aria-hidden="true" />
              최근 지출
            </h2>
            <Link to="/expense" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5">
              전체 보기
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </header>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
            </div>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">최근 지출 내역이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <li key={e.id} className="py-2.5 px-2 -mx-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                      {findExpenseCode(e.account_code)?.label ?? e.account_code}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
                      {e.description ?? '내역 없음'}
                      {e.payee_name && <span className="text-slate-400 ml-1">· {e.payee_name}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-orange-700 tabular-nums">
                      {formatMoney(e.gross_amount)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400 ml-1">{formatDateKo(e.expense_date)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <QuickActionsCard />
      </div>

      {/* 박경수님 + SkyClaw 2026-05-26 — 전체 재무 대시보드 (기간·프로젝트 필터) */}
      <FinancialDashboard />
    </div>
  );
}
