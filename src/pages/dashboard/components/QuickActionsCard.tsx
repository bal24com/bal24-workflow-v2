// bal24 v2 — 홈 빠른 액션 카드 (V7 빠른 액션 + 추천 액션 패널 차용)
// V7의 AI 호출은 제거. /ai 메뉴로 이동만 안내.

import { Link } from 'react-router-dom';
import { Zap, Plus, Sparkles, Calendar, Share2 } from 'lucide-react';

interface ActionItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const ACTIONS: ActionItem[] = [
  { to: '/projects', icon: <Plus size={14} aria-hidden="true" />, label: '프로젝트' },
  { to: '/programs', icon: <Plus size={14} aria-hidden="true" />, label: '프로그램' },
  { to: '/schedule', icon: <Calendar size={14} aria-hidden="true" />, label: '일정' },
  { to: '/shares', icon: <Share2 size={14} aria-hidden="true" />, label: '외부 공유' },
];

export default function QuickActionsCard() {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center gap-1.5">
        <Zap size={16} className="text-orange-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-[#1E1B4B]">빠른 액션</h2>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-200 transition-colors"
          >
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>

      <div className="mt-1 rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-orange-50/40 px-3 py-2.5">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-violet-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1E1B4B]">AI 어시스턴트로 더 빠르게</p>
            <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
              운영안 분석·태스크 생성·결과보고 초안 작성을 한 번에.
            </p>
            <Link
              to="/ai"
              className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold text-violet-600 hover:underline"
            >
              AI 메뉴 열기
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
