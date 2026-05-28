// bal24 v2 — 프로그램 상세 · 개요 탭 (STEP-OVERVIEW-CARD-FIX 슬림화)
// 단계 시작일 + 통계 KPI + 빠른 액션 + 수정요청 배지.
// 프로그램 설명 / 커리큘럼 미리보기는 상단 ProgramOverviewCard / ProgramCurriculumSummaryCard 와 중복 → 제거.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Users, ClipboardCheck, Star, ListChecks, ArrowRight, Calendar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { fetchProgramKpis, type ProgramKpis } from './programDetailUtils';
import EditRequestsBadge from './share/EditRequestsBadge';
import PhaseDateSection from './PhaseDateSection';
import FlowStatusCard from './FlowStatusCard';

interface Props {
  programId: string;
  /** STEP-OVERVIEW-CARD-FIX — 교육 종료일 지나면 자동 '결과' 단계 판정 */
  programEndDate?: string | null;
  /** STEP-V9-QUICKWIN QW-3 — 진행 흐름도 표시용 (program.status 또는 lifecycle_stage). */
  programStatus?: string | null;
  programStartDate?: string | null;
}

export default function OverviewTab({
  programId, programEndDate, programStatus, programStartDate,
}: Props) {
  const toast = useToast();
  const [kpis, setKpis] = useState<ProgramKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const k = await fetchProgramKpis(programId);
        if (cancelled) return;
        setKpis(k);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 개요 KPI 로드 실패:', raw);
        toast.error('통계 데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programId, toast]);

  return (
    <div className="space-y-4">
      {/* STEP-V9-QUICKWIN QW-3 — 진행 흐름도 카드 (전체 폭) */}
      <FlowStatusCard
        currentStage={programStatus ?? null}
        startDate={programStartDate ?? null}
        endDate={programEndDate ?? null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 좌: 단계 시작일 + 빠른 액션 (좌측 컬럼 비율 보정) */}
        <div className="flex flex-col gap-4">
          <PhaseDateSection programId={programId} programEndDate={programEndDate} />
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <Calendar size={16} className="text-orange-500" aria-hidden="true" />
            빠른 액션
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <QuickLink to="/attendance" label="출석 세션" />
            <QuickLink to="/forms" label="외부 폼" />
            <QuickLink to="/applications" label="신청 검토" />
            <QuickLink to="/activity-logs" label="일지 작성" />
          </div>
        </section>
      </div>

      {/* 우: 통계 KPI + 수정요청 */}
      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <ClipboardCheck size={16} className="text-violet-500" aria-hidden="true" />
            통계 KPI
          </h3>
          {loading || !kpis ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              <KpiTile label="신청"        value={`${kpis.applicationCount}건`}     sub={`승인 ${kpis.acceptedApplicationCount}건`} Icon={Users}          tone="violet" />
              <KpiTile label="출석 세션"   value={`${kpis.attendanceSessionCount}회`} sub={`체크인 ${kpis.attendanceCheckedInCount}건`} Icon={ClipboardCheck} tone="emerald" />
              <KpiTile label="활동 일지"   value={`${kpis.activityLogCount}건`}     sub="최근 기록" Icon={ListChecks} tone="orange" />
              <KpiTile label="만족도 응답" value={`${kpis.surveyCount}건`}          sub={kpis.surveyAvgRating != null ? `평균 ${kpis.surveyAvgRating}점` : '평점 없음'} Icon={Star} tone="cyan" />
            </div>
          )}
        </section>

          <EditRequestsBadge programId={programId} />
        </div>
      </div>
    </div>
  );
}

type Tone = 'violet' | 'orange' | 'cyan' | 'emerald';

const TONE_STYLE: Record<Tone, { bg: string; text: string; ring: string }> = {
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-600',  ring: 'border-violet-100' },
  orange:  { bg: 'bg-orange-100',  text: 'text-orange-600',  ring: 'border-orange-100' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-600',    ring: 'border-cyan-100' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'border-emerald-100' },
};

function KpiTile({
  label, value, sub, Icon, tone,
}: { label: string; value: string; sub: string; Icon: LucideIcon; tone: Tone }) {
  const t = TONE_STYLE[tone];
  return (
    <div className={`rounded-xl border ${t.ring} bg-white p-3 flex items-center gap-3`}>
      <span className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-600">{label}</p>
        <p className="text-[10px] text-slate-400 truncate">{sub}</p>
      </div>
      <span className={`shrink-0 text-lg font-bold tabular-nums ${t.text}`}>{value}</span>
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-between gap-1 h-10 px-3 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-200 transition-colors"
    >
      {label}
      <ArrowRight size={12} aria-hidden="true" />
    </Link>
  );
}
