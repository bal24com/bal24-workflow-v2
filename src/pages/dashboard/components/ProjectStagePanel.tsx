// bal24 v2 — 단계별 통계 + 진행 중 프로젝트 카드 리스트
// (V7 HomeV9 진행 중 프로젝트 + 단계별 미니 통계 차용 / 6단계 → V2 4단계 매핑)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { BADGE_BASE, PROJECT_STATUS_STYLE } from '../../../utils/statusStyles';
import {
  fetchActiveProjects,
  fetchProjectStageCounts,
  type ActiveProjectRow,
  type ProjectStageCounts,
} from '../dashboardUtils';
import type { ProjectStatus } from '../../../types/database';

const STAGES: ProjectStatus[] = ['제안', '진행', '정산', '종료'];

const STAGE_TILE_STYLE: Record<ProjectStatus, string> = {
  제안: 'bg-slate-50 text-slate-500',
  진행: 'bg-violet-50 text-violet-600',
  정산: 'bg-orange-50 text-orange-600',
  종료: 'bg-cyan-50 text-cyan-600',
};

function StageTile({ stage, count }: { stage: ProjectStatus; count: number }) {
  return (
    <div className={`rounded-xl px-2 py-2.5 text-center ${STAGE_TILE_STYLE[stage]}`}>
      <p className="text-lg font-bold tabular-nums">{count}</p>
      <p className="text-[10px] font-semibold mt-0.5">{stage}</p>
    </div>
  );
}

function ProjectCardRow({ project }: { project: ActiveProjectRow }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 hover:bg-violet-50/40 hover:border-violet-200 transition-colors group"
    >
      <span className={`${BADGE_BASE} ${PROJECT_STATUS_STYLE[project.status]} shrink-0`}>
        {project.status}
      </span>
      <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B] group-hover:text-violet-700 transition-colors">
        {project.name}
      </span>
      {project.client_name && (
        <span className="hidden sm:inline shrink-0 text-[11px] text-slate-500 truncate max-w-[120px]">
          {project.client_name}
        </span>
      )}
      <ArrowRight
        size={14}
        className="shrink-0 text-slate-300 group-hover:text-violet-500 transition-colors"
        aria-hidden="true"
      />
    </Link>
  );
}

export default function ProjectStagePanel() {
  const toast = useToast();
  const [stageCounts, setStageCounts] = useState<ProjectStageCounts | null>(null);
  const [activeProjects, setActiveProjects] = useState<ActiveProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [counts, projects] = await Promise.all([
          fetchProjectStageCounts(),
          fetchActiveProjects(6),
        ]);
        if (cancelled) return;
        setStageCounts(counts);
        setActiveProjects(projects);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[dashboard] 단계·프로젝트 조회 실패:', raw);
        toast.error('진행 중 프로젝트 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Briefcase size={16} className="text-violet-500" aria-hidden="true" />
          진행 중 프로젝트
        </h2>
        <Link
          to="/projects"
          className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
        >
          전체 보기
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {STAGES.map((s) => (
              <StageTile key={s} stage={s} count={stageCounts?.[s] ?? 0} />
            ))}
          </div>

          {activeProjects.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">
              진행 중인 프로젝트가 없어요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {activeProjects.map((p) => (
                <li key={p.id}>
                  <ProjectCardRow project={p} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
