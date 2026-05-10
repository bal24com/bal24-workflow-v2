// bal24 v2 — STEP-MEMBER-PERFORMANCE-REPORT 지출 증빙 섹션 (readonly)
// program_id 의 grant_expenditures 를 비목별 합계 표 + 건별 목록으로 표시.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink, FileCheck2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import {
  GRANT_FUND_TYPE_LABELS, GRANT_FUND_TYPE_TONE,
  type GrantExpenditure,
} from '../../../types/grantLedger';

interface Props {
  programId: string;
}

interface CategorySummary {
  category: string;
  count: number;
  total: number;
}

export default function GrantExpenditureSection({ programId }: Props) {
  const [items, setItems] = useState<GrantExpenditure[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('grant_expenditures')
        .select('*')
        .eq('program_id', programId)
        .order('expenditure_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        if (isMissingTableError(error.message)) {
          setTableMissing(true);
          setItems([]);
        } else {
          console.error('[performance-report] 지출증빙 조회 실패:', error.message);
          setItems([]);
        }
      } else {
        setTableMissing(false);
        setItems((data ?? []) as GrantExpenditure[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const summary = useMemo<CategorySummary[]>(() => {
    const map = new Map<string, CategorySummary>();
    items.forEach((e) => {
      const key = e.account_code?.trim() || '미분류';
      const cur = map.get(key) ?? { category: key, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(e.amount ?? 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [items]);

  const grandTotal = useMemo(
    () => items.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [items],
  );

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B]">④ 지출 증빙</h2>
        <span className="text-[11px] text-slate-500">자동 연동 — 지출 페이지에서 등록한 항목이 표시돼요.</span>
      </header>

      {tableMissing ? (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-900">
          지출원장 테이블이 아직 만들어지지 않았어요.
        </div>
      ) : loading ? (
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> 불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">아직 등록된 지출 증빙이 없어요. 지출 페이지에서 등록해 주세요.</p>
      ) : (
        <>
          {/* 비목별 합계 */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 overflow-x-auto">
            <p className="text-xs font-bold text-violet-700 mb-2">비목별 집행 합계</p>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1 font-semibold">비목</th>
                  <th className="text-right px-2 py-1 font-semibold">건수</th>
                  <th className="text-right px-2 py-1 font-semibold">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100 tabular-nums">
                {summary.map((s) => (
                  <tr key={s.category}>
                    <td className="px-2 py-1.5 font-semibold text-[#1E1B4B]">{s.category}</td>
                    <td className="px-2 py-1.5 text-right">{s.count}건</td>
                    <td className="px-2 py-1.5 text-right">{formatMoney(s.total)}</td>
                  </tr>
                ))}
                <tr className="bg-violet-100/40 font-bold">
                  <td className="px-2 py-1.5 text-[#1E1B4B]">총계</td>
                  <td className="px-2 py-1.5 text-right">{items.length}건</td>
                  <td className="px-2 py-1.5 text-right text-violet-700">{formatMoney(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 건별 목록 */}
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">지출일</th>
                  <th className="text-left px-2 py-1.5 font-semibold">항목</th>
                  <th className="text-left px-2 py-1.5 font-semibold whitespace-nowrap">자금</th>
                  <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">금액</th>
                  <th className="text-center px-2 py-1.5 font-semibold whitespace-nowrap">증빙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-violet-50/30">
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{formatDateKo(e.expenditure_date)}</td>
                    <td className="px-2 py-1.5">
                      <p className="font-semibold text-[#1E1B4B] truncate max-w-[260px]">{e.item_name}</p>
                      {e.vendor_name && <p className="text-[10px] text-slate-400">{e.vendor_name}</p>}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${GRANT_FUND_TYPE_TONE[e.fund_type]}`}>
                        {GRANT_FUND_TYPE_LABELS[e.fund_type]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-[#1E1B4B]">{formatMoney(e.amount)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {e.receipt_url ? (
                        <a href={e.receipt_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] text-violet-700 hover:underline">
                          <ExternalLink size={10} aria-hidden="true" />
                          영수증
                        </a>
                      ) : e.docs_submitted ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700">
                          <FileCheck2 size={10} aria-hidden="true" />
                          서류 완료
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
