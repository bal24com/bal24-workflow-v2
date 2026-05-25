// 견적 표 정렬·필터·헤더 셀 헬퍼 (EstimateTab V-1 분리)
// 박경수님 요청 — 항목 정렬 + 필터/검색

import type { EstimateItem, PayrollTaxRateType } from '../../types/database';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type SortKey = 'category' | 'description' | 'payee_name' | 'unit_price' | 'quantity' | 'headcount' | 'subtotal' | 'tax_rate_type';
export type SortDir = 'asc' | 'desc';

export type DraftItem = Pick<EstimateItem,
  'category' | 'description' | 'payee_name' | 'unit_price' | 'quantity' | 'headcount' | 'tax_rate_type' | 'memo' | 'order_index'
> & { _existingId?: string; _converted?: boolean };

export function emptyDraft(idx: number): DraftItem {
  return {
    category: '인건비', description: '', payee_name: '',
    unit_price: 0, quantity: 1, headcount: 1,
    tax_rate_type: '없음' as PayrollTaxRateType,
    memo: '', order_index: idx,
  };
}

export interface VisibleRow extends DraftItem { _idx: number }

export function applyFilterSort(
  items: DraftItem[],
  opts: { search: string; catFilter: string; sortKey: SortKey | null; sortDir: SortDir },
): VisibleRow[] {
  const q = opts.search.trim().toLowerCase();
  let arr: VisibleRow[] = items.map((it, i) => ({ ...it, _idx: i }));
  if (opts.catFilter) arr = arr.filter((it) => it.category === opts.catFilter);
  if (q) arr = arr.filter((it) => [it.category, it.description, it.payee_name, it.memo]
    .filter(Boolean).join(' ').toLowerCase().includes(q));
  if (opts.sortKey) {
    const k = opts.sortKey;
    const dir = opts.sortDir === 'asc' ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      if (k === 'subtotal') {
        const sa = a.unit_price * a.quantity * (a.headcount ?? 1);
        const sb = b.unit_price * b.quantity * (b.headcount ?? 1);
        return (sa - sb) * dir;
      }
      const va = a[k] as string | number; const vb = b[k] as string | number;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'ko') * dir;
    });
  }
  return arr;
}

export function EstSortTh({ k, sortKey, sortDir, onClick, align, children }: {
  k: SortKey; sortKey: SortKey | null; sortDir: SortDir; onClick: (k: SortKey) => void;
  align: 'left' | 'right' | 'center'; children: React.ReactNode;
}) {
  const active = sortKey === k;
  const alignClass = align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
  const justifyClass = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  return (
    <th className={`${alignClass} px-3 py-2 font-semibold whitespace-nowrap`}>
      <button type="button" onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 w-full ${justifyClass} hover:text-violet-700 ${active ? 'text-violet-700' : ''}`}>
        {children}
        {active
          ? (sortDir === 'asc' ? <ArrowUp size={9} aria-hidden="true" /> : <ArrowDown size={9} aria-hidden="true" />)
          : <ArrowUpDown size={9} aria-hidden="true" className="opacity-30" />}
      </button>
    </th>
  );
}
