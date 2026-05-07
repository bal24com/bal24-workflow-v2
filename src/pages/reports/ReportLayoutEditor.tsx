// bal24 v2 — 재무 리포트 레이아웃 편집기 (STEP 20)
// visible 항목 위/아래 이동 + 숨김 / 숨겨진 항목 추가 복원

import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react';
import { LAYOUT_LABEL, type LayoutItem, type LayoutItemKey } from './financialReportUtils';

interface Props {
  layout: LayoutItem[];
  onChange: (next: LayoutItem[]) => void;
}

function reorder(items: LayoutItem[]): LayoutItem[] {
  const visible = items.filter((i) => i.visible).sort((a, b) => a.order - b.order);
  const hidden = items.filter((i) => !i.visible).sort((a, b) => a.order - b.order);
  const all = [...visible, ...hidden].map((item, idx) => ({ ...item, order: idx }));
  return all;
}

export default function ReportLayoutEditor({ layout, onChange }: Props) {
  const visible = layout.filter((i) => i.visible).sort((a, b) => a.order - b.order);
  const hidden = layout.filter((i) => !i.visible).sort((a, b) => a.order - b.order);

  const move = (key: LayoutItemKey, direction: -1 | 1) => {
    const list = [...visible];
    const idx = list.findIndex((i) => i.key === key);
    const swap = idx + direction;
    if (idx === -1 || swap < 0 || swap >= list.length) return;
    [list[idx], list[swap]] = [list[swap], list[idx]];
    const next = reorder([...list, ...hidden]);
    onChange(next);
  };

  const hide = (key: LayoutItemKey) => {
    const next = reorder(layout.map((i) => (i.key === key ? { ...i, visible: false } : i)));
    onChange(next);
  };

  const show = (key: LayoutItemKey) => {
    const next = reorder(layout.map((i) => (i.key === key ? { ...i, visible: true } : i)));
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">표시 중인 항목</h3>
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">표시 중인 항목이 없어요. 아래에서 추가해 주세요.</p>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((item, idx) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2"
              >
                <span className="text-xs font-mono text-slate-400 w-5 text-right">{idx + 1}</span>
                <span className="flex-1 text-sm font-semibold text-[#1E1B4B] truncate">
                  {LAYOUT_LABEL[item.key]}
                </span>
                <button
                  type="button"
                  aria-label="위로 이동"
                  onClick={() => move(item.key, -1)}
                  disabled={idx === 0}
                  className="rounded-lg p-1 text-slate-500 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronUp size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="아래로 이동"
                  onClick={() => move(item.key, 1)}
                  disabled={idx === visible.length - 1}
                  className="rounded-lg p-1 text-slate-500 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="숨김"
                  onClick={() => hide(item.key)}
                  className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hidden.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">추가 가능 항목</h3>
          <ul className="space-y-1.5">
            {hidden.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="flex-1 text-sm text-slate-600 truncate">{LAYOUT_LABEL[item.key]}</span>
                <button
                  type="button"
                  onClick={() => show(item.key)}
                  className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-200 transition-colors"
                >
                  <Plus size={14} aria-hidden="true" />
                  추가
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
