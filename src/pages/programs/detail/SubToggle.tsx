// bal24 v2 — 통합 탭 내부 sub-tab 토글 (공통 헬퍼)

interface ToggleItem<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  items: ToggleItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

export default function SubToggle<K extends string>({ items, active, onChange }: Props<K>) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
      {items.map((item) => {
        const on = active === item.key;
        return (
          <button key={item.key} type="button" role="tab" aria-selected={on}
            onClick={() => onChange(item.key)}
            className={[
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              on ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white',
            ].join(' ')}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
