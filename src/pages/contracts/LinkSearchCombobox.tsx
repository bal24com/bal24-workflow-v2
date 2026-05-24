// 계약 연결 대상 커스텀 콤보박스 — 프로젝트/프로그램/컨소시엄 통합 검색
// STEP-ACCOUNTING-FOLLOWUP5: datalist 대체 — 실시간 드롭다운 + 키보드 네비 + type 배지 + 메타

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { formatMoney } from '../../lib/utils';
import type { LinkOption, LinkType } from './contractUtils';
import { LINK_TYPE_LABEL } from './contractUtils';

interface Props {
  options: LinkOption[];
  value: string; // 화면 표시용 (선택된 항목명 또는 입력 텍스트)
  onSelect: (option: LinkOption | null) => void;
  placeholder?: string;
}

const TYPE_BADGE: Record<LinkType, string> = {
  project:    'bg-violet-100 text-violet-700 border-violet-200',
  program:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  consortium: 'bg-amber-100 text-amber-700 border-amber-200',
};

/** 단순 매칭 점수 — 정확 일치 > prefix > 부분 포함 */
function matchScore(text: string, q: string): number {
  const t = text.toLowerCase();
  const s = q.toLowerCase();
  if (t === s) return 100;
  if (t.startsWith(s)) return 80;
  if (t.includes(s)) return 50;
  return 0;
}

export default function LinkSearchCombobox({ options, value, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 외부 value 변경 시 입력창 동기화
  useEffect(() => { setQuery(value); }, [value]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options.slice(0, 20);
    return options
      .map((o) => ({ o, score: matchScore(o.name, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.o);
  }, [options, query]);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && filtered[activeIdx]) {
      e.preventDefault();
      pickOption(filtered[activeIdx]);
    } else if (e.key === 'Escape') { setOpen(false); }
  }

  function pickOption(opt: LinkOption) {
    onSelect(opt);
    setQuery(opt.name);
    setOpen(false);
  }

  function handleClear() {
    setQuery('');
    onSelect(null);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? '이름으로 검색'}
          className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-8 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100"
            aria-label="검색어 지우기"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {filtered.map((o, i) => {
            const active = i === activeIdx;
            return (
              <li
                key={o.key}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pickOption(o)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${active ? 'bg-violet-50' : 'hover:bg-slate-50'}`}
              >
                <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${TYPE_BADGE[o.type]}`}>
                  {LINK_TYPE_LABEL[o.type]}
                </span>
                <span className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{o.name}</div>
                  {(o.amount != null || o.clientName) && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {o.clientName && <span>{o.clientName}</span>}
                      {o.clientName && o.amount != null && <span> · </span>}
                      {o.amount != null && <span className="tabular-nums">{formatMoney(o.amount)}</span>}
                    </div>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-3 text-xs text-slate-400 italic">
          일치하는 항목이 없어요. 정확한 프로젝트·프로그램·컨소시엄 이름인지 확인해 주세요.
        </div>
      )}
    </div>
  );
}
