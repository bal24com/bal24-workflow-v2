// 프로그램 [지급요청] 메인 — 제안 견적(estimates) vs 실제 집행(payroll_expenses)
// 박경수님 요청: 좌-제안 견적 / 우-실제 집행 좌우 2분할 비교

import { useEffect, useState } from 'react';
import { Loader2, FileBarChart, Wallet, AlertCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { isOutsourceType, isOperationType } from '../../payroll/payrollUtils';

interface Props {
  programId: string;
  projectId: string | null;
}

interface EstimateLine { category: string; amount: number }
interface ExecLine { group: '인건비' | '운영비' | '기타'; amount: number }

interface Summary {
  estimateTotal: number;
  estimateLines: EstimateLine[];
  execTotal: number;
  execLines: ExecLine[];
  vatTotal: number;          // 박경수님 요청 — 운영비 부가세 합계
  withholdingTotal: number;  // 인건비 원천세 합계
}

export default function PaymentSummaryCards({ programId, projectId }: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // 제안 견적 — 부모 프로젝트의 최신 견적 1건 (programId 일치 항목 우선)
      let estimateLines: EstimateLine[] = [];
      let estimateTotal = 0;
      if (projectId) {
        const { data: est } = await supabase.from('project_estimates')
          .select('id, items:estimate_items(category, amount, program_id)')
          .eq('project_id', projectId).is('deleted_at', null)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        const items = (est as { items?: Array<{ category: string; amount: number; program_id: string | null }> } | null)?.items ?? [];
        const relevant = items.filter((it) => !it.program_id || it.program_id === programId);
        const byCat: Record<string, number> = {};
        for (const it of relevant) byCat[it.category] = (byCat[it.category] ?? 0) + Number(it.amount ?? 0);
        estimateLines = Object.entries(byCat).map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);
        estimateTotal = relevant.reduce((s, it) => s + Number(it.amount ?? 0), 0);
      }

      // 실제 집행 — payroll_expenses (program_id) 종합 + 부가세/원천세 분리
      const { data: payr } = await supabase.from('payroll_expenses')
        .select('expense_type, subtotal, tax_amount, tax_rate_type').eq('program_id', programId).is('deleted_at', null);
      let outsource = 0; let operation = 0; let etc = 0; let vatTotal = 0; let withholdingTotal = 0;
      for (const r of (payr ?? []) as Array<{ expense_type: string; subtotal: number | string | null; tax_amount: number | string | null; tax_rate_type: string | null }>) {
        const amt = Number(r.subtotal ?? 0);
        const tax = Number(r.tax_amount ?? 0);
        if (isOutsourceType(r.expense_type)) outsource += amt;
        else if (isOperationType(r.expense_type)) operation += amt;
        else etc += amt;
        if (r.tax_rate_type === '10') vatTotal += tax;
        else if (r.tax_rate_type === '3.3' || r.tax_rate_type === '8.8') withholdingTotal += tax;
      }
      const execTotal = outsource + operation + etc;
      const execLines: ExecLine[] = [
        { group: '인건비', amount: outsource },
        { group: '운영비', amount: operation },
        ...(etc > 0 ? [{ group: '기타' as const, amount: etc }] : []),
      ];

      if (cancelled) return;
      setData({ estimateTotal, estimateLines, execTotal, execLines, vatTotal, withholdingTotal });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, projectId]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted">
        <Loader2 size={16} className="animate-spin mr-2" />집계 중…
      </div>
    );
  }

  const diff = data.execTotal - data.estimateTotal;
  const overBudget = data.estimateTotal > 0 && diff > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* 좌 — 제안 견적 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <FileBarChart size={14} className="text-violet-500" aria-hidden="true" />
            제안 견적
          </h3>
          <span className="text-base font-bold text-violet-700 tabular-nums">{formatMoney(data.estimateTotal)}</span>
        </header>
        {data.estimateLines.length === 0 ? (
          <p className="text-xs text-slate-400 italic">견적서 항목이 없어요. 견적 탭에서 등록하면 자동으로 반영됩니다.</p>
        ) : (
          <ul className="space-y-1">
            {data.estimateLines.map((l) => (
              <li key={l.category} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{l.category}</span>
                <span className="tabular-nums text-slate-700">{formatMoney(l.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 우 — 실제 집행 */}
      <section className={`rounded-2xl border bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2 ${overBudget ? 'border-rose-200' : 'border-emerald-100'}`}>
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <Wallet size={14} className={overBudget ? 'text-rose-500' : 'text-emerald-500'} aria-hidden="true" />
            실제 집행
          </h3>
          <span className={`text-base font-bold tabular-nums ${overBudget ? 'text-rose-700' : 'text-emerald-700'}`}>{formatMoney(data.execTotal)}</span>
        </header>
        <ul className="space-y-1">
          {data.execLines.map((l) => (
            <li key={l.group} className="flex items-center justify-between text-xs">
              <span className="text-slate-600">{l.group}</span>
              <span className="tabular-nums text-slate-700">{formatMoney(l.amount)}</span>
            </li>
          ))}
          {(data.vatTotal > 0 || data.withholdingTotal > 0) && (
            <li className="pt-1 mt-1 border-t border-slate-100 space-y-0.5">
              {data.vatTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] text-blue-600">
                  <span>└ 부가세 (운영비 포함)</span>
                  <span className="tabular-nums">{formatMoney(data.vatTotal)}</span>
                </div>
              )}
              {data.withholdingTotal > 0 && (
                <div className="flex items-center justify-between text-[11px] text-rose-600">
                  <span>└ 원천세 (인건비)</span>
                  <span className="tabular-nums">▲ {formatMoney(data.withholdingTotal)}</span>
                </div>
              )}
            </li>
          )}
        </ul>
        {data.estimateTotal > 0 && (
          <div className={`pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold ${overBudget ? 'text-rose-600' : 'text-emerald-700'}`}>
            <span className="inline-flex items-center gap-1">
              {overBudget && <AlertCircle size={11} aria-hidden="true" />}
              {overBudget ? '견적 초과' : '잔여 (견적 - 집행)'}
            </span>
            <span className="tabular-nums">{formatMoney(Math.abs(diff))}</span>
          </div>
        )}
      </section>
    </div>
  );
}
