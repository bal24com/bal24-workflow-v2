// bal24 v2 — 프로젝트 개요 · 빠른 액션 카드 (V7 차용)
// 자주 쓰는 4개 액션 + 컨소시엄 연결 시 별도 링크.

import { Link } from 'react-router-dom';
import { Zap, ClipboardList, Calendar, FileBarChart, Share2, Users2, ArrowRight } from 'lucide-react';

interface Props {
  projectId: string;
  consortiumId?: string | null;
  /** 부모에서 setTab으로 전환 */
  onOpenTasksTab?: () => void;
}

export default function QuickActionsCard({ projectId, consortiumId, onOpenTasksTab }: Props) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center gap-1.5">
        <Zap size={16} className="text-orange-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[#1E1B4B]">빠른 액션</h3>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpenTasksTab}
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-200 transition-colors"
        >
          <ClipboardList size={14} aria-hidden="true" />
          태스크
        </button>
        <Link
          to="/schedule"
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-orange-100 bg-orange-50/40 text-xs font-semibold text-orange-700 hover:bg-orange-100 hover:border-orange-200 transition-colors"
        >
          <Calendar size={14} aria-hidden="true" />
          일정
        </Link>
        <Link
          to={`/projects/${projectId}/report`}
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-cyan-100 bg-cyan-50/40 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 hover:border-cyan-200 transition-colors"
        >
          <FileBarChart size={14} aria-hidden="true" />
          결과보고서
        </Link>
        <Link
          to="/shares"
          className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-emerald-100 bg-emerald-50/40 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 transition-colors"
        >
          <Share2 size={14} aria-hidden="true" />
          외부 공유
        </Link>
      </div>

      {consortiumId && (
        <Link
          to={`/consortium/${consortiumId}`}
          className="inline-flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50/60 to-orange-50/60 text-xs font-semibold text-violet-700 hover:from-violet-100 hover:to-orange-100 transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <Users2 size={14} aria-hidden="true" />
            컨소시엄 페이지 열기
          </span>
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
