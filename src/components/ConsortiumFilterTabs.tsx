// bal24 v2 — 컨소시엄 필터 탭 (Programs/Projects 공유)
// 전체 / 자체 사업 / 컨소시엄N — 토글 버튼 그룹.

export type ConsortiumFilter = string | null | 'none';

export interface ConsortiumOption {
  id: string;
  name: string;
}

interface Props {
  consortiums: ConsortiumOption[];
  value: ConsortiumFilter;
  onChange: (next: ConsortiumFilter) => void;
}

export default function ConsortiumFilterTabs({ consortiums, value, onChange }: Props) {
  if (consortiums.length === 0) return null;

  const baseClass = 'inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors';
  const activePrimary = 'bg-primary text-white shadow-sm';
  const activeNeutral = 'bg-slate-700 text-white shadow-sm';
  const inactive = 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-slate-500">컨소시엄</div>
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="컨소시엄 필터">
        <button
          type="button"
          role="tab"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          className={`${baseClass} ${value === null ? activePrimary : inactive}`}
        >
          전체
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'none'}
          onClick={() => onChange('none')}
          className={`${baseClass} ${value === 'none' ? activeNeutral : inactive}`}
        >
          자체 사업
        </button>
        {consortiums.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={value === c.id}
            onClick={() => onChange(c.id)}
            className={`${baseClass} ${value === c.id ? activePrimary : inactive}`}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
