// bal24 v2 — ProgramsPage 상태·유형 필터 탭 (분리)

interface Props<T extends string> {
  values: T[];
  value: T;
  onChange: (next: T) => void;
  counts?: Record<string, number>;
  ariaLabel: string;
}

export default function ProgramsFilterTabs<T extends string>({
  values, value, onChange, counts, ariaLabel,
}: Props<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={ariaLabel}>
      {values.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            {s}
            {counts && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}
              >
                {counts[s] ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
