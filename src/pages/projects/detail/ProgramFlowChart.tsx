// bal24 v2 — 프로젝트 프로그램 흐름도 컨테이너 (STEP-PROJECT-FLOW)
// 가로 스크롤 카드 + 정렬 드롭다운 + 완료 분리 프레임 + 빈 상태.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, ChevronUp, Loader2, Plus, Workflow,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import {
  fetchProjectPrograms, sortPrograms, isProgramDone,
  FLOW_SORT_OPTIONS,
  type FlowProgram, type FlowSortKey,
} from './projectDetailUtils';
import ProgramFlowCard from './ProgramFlowCard';

interface Props {
  projectId: string;
}

export default function ProgramFlowChart({ projectId }: Props) {
  const [programs, setPrograms] = useState<FlowProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<FlowSortKey>('display_order');
  const [showDone, setShowDone] = useState(true);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    const data = await fetchProjectPrograms(projectId);
    setPrograms(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadPrograms();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loadPrograms]);

  const { active, done } = useMemo(() => {
    const sorted = sortPrograms(programs, sortKey);
    return {
      active: sorted.filter((p) => !isProgramDone(p.status)),
      done:   sorted.filter((p) =>  isProgramDone(p.status)),
    };
  }, [programs, sortKey]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Workflow size={16} className="text-violet-500" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#1E1B4B]">프로그램 흐름도</h3>
            <span className="text-[11px] text-slate-400">({programs.length})</span>
          </div>
          {programs.length > 0 && (
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as FlowSortKey)}
              className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 outline-none focus:border-primary"
              aria-label="흐름도 정렬"
            >
              {FLOW_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
        </div>

        {/* 본문 */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
          </div>
        ) : programs.length === 0 ? (
          <EmptyState
            emoji="🎓"
            title="아직 등록된 프로그램이 없어요"
            description='프로그램을 추가하면 여기에 흐름도가 표시돼요.'
            action={
              <Link
                to="/programs"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
              >
                <Plus size={12} aria-hidden="true" />
                프로그램 추가
              </Link>
            }
          />
        ) : (
          <>
            {/* 진행 중 — 가로 스크롤 */}
            {active.length > 0 ? (
              <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
                {active.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 shrink-0">
                    <ProgramFlowCard program={p} isDone={false} />
                    {i < active.length - 1 && (
                      <ChevronRight size={16} className="text-slate-300 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic text-center py-3">
                진행 중인 프로그램이 없어요. 모든 프로그램이 완료됐어요.
              </p>
            )}

            {/* 완료 — 별도 프레임 (접기 가능) */}
            {done.length > 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    완료된 프로그램 {done.length}개
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDone((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {showDone ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                    {showDone ? '접기' : '펼치기'}
                  </button>
                </div>
                {showDone && (
                  <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
                    {done.map((p) => (
                      <ProgramFlowCard key={p.id} program={p} isDone />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
