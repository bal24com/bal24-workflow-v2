// bal24 v2 — 프로그램 상세 · 개요 탭 (V7 → V2 이식 1단계)
// 기본정보 + 통계 KPI + 커리큘럼 미리보기 + 빠른 액션.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Users, ClipboardCheck, FileText, Star, ListChecks,
  ArrowRight, BookOpen, Calendar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import {
  fetchProgramKpis,
  fetchProgramCurriculum,
  type ProgramKpis,
  type CurriculumRow,
} from './programDetailUtils';
import EditRequestsBadge from './share/EditRequestsBadge';
import PhaseDateSection from './PhaseDateSection';

interface Props {
  programId: string;
  description: string | null;
}

export default function OverviewTab({ programId, description }: Props) {
  const toast = useToast();
  const [kpis, setKpis] = useState<ProgramKpis | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [k, c] = await Promise.all([
          fetchProgramKpis(programId),
          fetchProgramCurriculum(programId, 5),
        ]);
        if (cancelled) return;
        setKpis(k);
        setCurriculum(c);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 개요 로드 실패:', raw);
        toast.error('개요 데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  return (
    <div className="flex flex-col gap-4">
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      {/* 좌: 설명 + 커리큘럼 */}
      <div className="flex flex-col gap-4 min-w-0">
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <h3 className="text-sm font-bold text-[#1E1B4B] mb-2 flex items-center gap-1.5">
            <FileText size={16} className="text-violet-500" aria-hidden="true" />
            프로그램 설명
          </h3>
          {description ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{description}</p>
          ) : (
            <p className="text-sm text-slate-400 italic">아직 등록된 설명이 없어요.</p>
          )}
        </section>

        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
              <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
              커리큘럼 미리보기
              {!loading && curriculum.length > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">최근 {curriculum.length}차시</span>
              )}
            </h3>
          </header>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
            </div>
          ) : curriculum.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">
              등록된 차시가 없어요. 후속 STEP에서 차시 등록 화면을 만들 예정이에요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {curriculum.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2"
                >
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                    {c.day_num}일·{c.session_num}차
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {c.title}
                  </span>
                  {c.start_time && (
                    <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                      {c.start_time.slice(0, 5)}
                      {c.end_time && `~${c.end_time.slice(0, 5)}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 우: KPI + 빠른 액션 */}
      <div className="flex flex-col gap-4 min-w-0">
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
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                label="신청"
                value={`${kpis.applicationCount}건`}
                sub={`승인 ${kpis.acceptedApplicationCount}건`}
                Icon={Users}
                tone="violet"
              />
              <KpiTile
                label="출석 세션"
                value={`${kpis.attendanceSessionCount}회`}
                sub={`체크인 ${kpis.attendanceCheckedInCount}건`}
                Icon={ClipboardCheck}
                tone="emerald"
              />
              <KpiTile
                label="활동 일지"
                value={`${kpis.activityLogCount}건`}
                sub="최근 기록"
                Icon={ListChecks}
                tone="orange"
              />
              <KpiTile
                label="만족도 응답"
                value={`${kpis.surveyCount}건`}
                sub={kpis.surveyAvgRating != null ? `평균 ${kpis.surveyAvgRating}점` : '평점 없음'}
                Icon={Star}
                tone="cyan"
              />
            </div>
          )}
        </section>

        <EditRequestsBadge programId={programId} />

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
    </div>

    {/* STEP-PHASE-DATE-FULL — 개요 탭 하단에 단계 시작일 편집 카드 (외부공유 연동) */}
    <PhaseDateSection programId={programId} />
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
    <div className={`rounded-xl border ${t.ring} bg-white p-3 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>
      <div className={`text-lg font-bold tabular-nums ${t.text}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{sub}</div>
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
