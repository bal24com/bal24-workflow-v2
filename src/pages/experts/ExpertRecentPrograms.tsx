// bal24 v2 — STEP-EXPERTS-UI-REFINE (박경수님 2026-05-26)
// 전문가 카드 — 최근 참여 프로그램 미니 카드 (최대 3개). 클릭 시 /programs/:id 이동.

import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import type { ExpertProgramRef } from './expertProgramsFetch';

interface Props {
  programs: ExpertProgramRef[] | undefined;
  variant?: 'card' | 'list';
}

const PROG_STATUS: Record<string, { label: string; cls: string }> = {
  draft:        { label: '작성중', cls: 'bg-slate-100 text-slate-600' },
  active:       { label: '진행중', cls: 'bg-violet-100 text-violet-700' },
  in_progress:  { label: '진행중', cls: 'bg-violet-100 text-violet-700' },
  preparing:    { label: '준비중', cls: 'bg-amber-100 text-amber-700' },
  scheduled:    { label: '예정',   cls: 'bg-blue-100 text-blue-700' },
  completed:    { label: '완료',   cls: 'bg-emerald-100 text-emerald-700' },
  closed:       { label: '종료',   cls: 'bg-slate-200 text-slate-500' },
  cancelled:    { label: '취소',   cls: 'bg-rose-100 text-rose-700' },
};

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const info = PROG_STATUS[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}

export default function ExpertRecentPrograms({ programs, variant = 'card' }: Props) {
  const navigate = useNavigate();
  const list = programs ?? [];

  if (variant === 'list') {
    // 리스트 행에서는 한 줄로 간단히 (최대 2개)
    if (list.length === 0) {
      return <span className="text-[11px] text-slate-400">참여 이력 없음</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {list.slice(0, 2).map((p) => (
          <button key={p.id} type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/programs/${p.id}`); }}
            title={p.name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
              bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors max-w-[180px]">
            <span className="truncate">{p.name}</span>
          </button>
        ))}
        {list.length > 2 && (
          <span className="text-[11px] text-slate-400 self-center">+{list.length - 2}</span>
        )}
      </div>
    );
  }

  // 카드 형태 (그리드 카드 내부) — 최대 3개 풀 미니 카드
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 mb-2 inline-flex items-center gap-1">
        <Calendar size={11} aria-hidden="true" /> 최근 참여 프로그램
      </p>
      {list.length === 0 ? (
        <p className="text-xs text-slate-400 py-1">아직 참여한 프로그램이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((p) => (
            <button key={p.id} type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/programs/${p.id}`); }}
              className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 border border-slate-200
                hover:border-violet-400 hover:bg-violet-50 transition-colors group">
              <p className="text-xs font-medium text-slate-700 truncate group-hover:text-violet-700">
                {p.name}
              </p>
              <div className="flex items-center justify-between mt-0.5 gap-2">
                <span className="text-[11px] text-slate-400 tabular-nums truncate">
                  {formatDateShort(p.start_date)}
                  {p.end_date ? ` ~ ${formatDateShort(p.end_date)}` : ''}
                </span>
                <StatusBadge status={p.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
