// 태그 분류 탭 — 고객사·전문가 공용 (STEP-TAGS-2B-3B)
// 전체 + 관리자 등록 태그 칩 형태로 노출, 클릭 시 활성 태그 변경.

import type { TagCategory } from '../types/database';

interface Props {
  categories: TagCategory[];
  active: string;
  counts: Record<string, number>;
  onChange: (name: string) => void;
}

export default function TagFilterTabs({ categories, active, counts, onChange }: Props) {
  if (categories.length === 0) return null;
  const names = ['전체', ...categories.map((t) => t.name)];
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="분류 탭">
      {names.map((name) => {
        const isActive = active === name;
        return (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isActive ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {name}
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${
              isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[name] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
