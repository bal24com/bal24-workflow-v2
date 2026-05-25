// 외주/급여 [통계] 탭 — KPI + 카테고리·프로젝트별 합계 (박경수님 요청 1탭)

import { useMemo } from 'react';
import { formatMoney } from '../../lib/utils';
import { isOutsourceType, isOperationType, type PayrollRow } from './payrollUtils';

interface Props { rows: PayrollRow[] }

interface CatLine { category: string; group: '인건비' | '운영비' | '기타'; subtotal: number; tax: number; net: number; count: number }
interface ProjLine { id: string; name: string; subtotal: number; count: number }

export default function PayrollStatsPanel({ rows }: Props) {
  const stats = useMemo(() => {
    const byCat = new Map<string, CatLine>();
    const byProj = new Map<string, ProjLine>();
    let outsourceSum = 0; let operationSum = 0;

    for (const r of rows) {
      const sub = Number(r.subtotal ?? 0);
      const tax = Number(r.tax_amount ?? 0);
      const net = Number(r.net_amount ?? sub - tax);
      const grp: CatLine['group'] = isOutsourceType(r.expense_type)
        ? '인건비'
        : isOperationType(r.expense_type) ? '운영비' : '기타';
      if (grp === '인건비') outsourceSum += sub;
      else if (grp === '운영비') operationSum += sub;

      const cur = byCat.get(r.expense_type) ?? { category: r.expense_type, group: grp, subtotal: 0, tax: 0, net: 0, count: 0 };
      cur.subtotal += sub; cur.tax += tax; cur.net += net; cur.count += 1;
      byCat.set(r.expense_type, cur);

      if (r.project?.id) {
        const pid = r.project.id;
        const pcur = byProj.get(pid) ?? { id: pid, name: r.project.name ?? '미지정', subtotal: 0, count: 0 };
        pcur.subtotal += sub; pcur.count += 1;
        byProj.set(pid, pcur);
      }
    }
    const totalSub = outsourceSum + operationSum;
    return {
      catLines: Array.from(byCat.values()).sort((a, b) => b.subtotal - a.subtotal),
      projLines: Array.from(byProj.values()).sort((a, b) => b.subtotal - a.subtotal).slice(0, 8),
      outsourceSum, operationSum, totalSub,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* 그룹 비교 — 인건비 vs 운영비 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="총 집행" value={formatMoney(stats.totalSub)} tone="violet" />
        <KpiCard label="인건비 (외주)" value={formatMoney(stats.outsourceSum)} sub={`${ratio(stats.outsourceSum, stats.totalSub)}%`} tone="cyan" />
        <KpiCard label="운영비" value={formatMoney(stats.operationSum)} sub={`${ratio(stats.operationSum, stats.totalSub)}%`} tone="orange" />
      </div>

      {/* 카테고리별 합계 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">카테고리별 합계</h3>
        {stats.catLines.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">집계할 데이터가 없어요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold">카테고리</th>
                <th className="text-left px-2 py-1.5 font-semibold">구분</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">건수</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">세전</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">원천세</th>
                <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">실지급</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.catLines.map((l) => (
                <tr key={l.category} className="hover:bg-violet-50/40">
                  <td className="px-2 py-1.5 text-xs font-semibold text-violet-700">{l.category}</td>
                  <td className="px-2 py-1.5 text-xs">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                      l.group === '인건비' ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                      : l.group === '운영비' ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{l.group}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums">{l.count}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums">{formatMoney(l.subtotal)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-rose-600">{l.tax > 0 ? `-${formatMoney(l.tax)}` : '-'}</td>
                  <td className="px-2 py-1.5 text-right text-sm font-bold tabular-nums text-violet-700">{formatMoney(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 프로젝트별 Top 8 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">프로젝트별 집행 (상위 8)</h3>
        {stats.projLines.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">집계할 데이터가 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {stats.projLines.map((p) => {
              const pct = stats.totalSub > 0 ? Math.round((p.subtotal / stats.totalSub) * 100) : 0;
              return (
                <li key={p.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate">{p.name}</span>
                    <span className="tabular-nums text-slate-500">{p.count}건 · <span className="font-bold text-violet-700">{formatMoney(p.subtotal)}</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-violet-50 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${pct}%` }} aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ratio(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

type Tone = 'violet' | 'cyan' | 'orange';
const TONE: Record<Tone, string> = {
  violet: 'border-violet-100 bg-violet-50/40 text-violet-700',
  cyan: 'border-cyan-100 bg-cyan-50/40 text-cyan-700',
  orange: 'border-orange-100 bg-orange-50/40 text-orange-700',
};

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: Tone }) {
  return (
    <div className={`rounded-2xl border p-4 ${TONE[tone]}`}>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
