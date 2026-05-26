// 선택 프로젝트 상세 재무 — 박경수님 + SkyClaw STEP-FINANCE-DASHBOARD-UI (2026-05-27)
// 세액 카드 3개 + 프로그램별 집계 테이블.
// 박경수님 환경 컬럼: payroll_expenses.subtotal·tax_amount·expense_type / income_contracts.contract_amount·vat_type·deposited_at

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { isPersonCategory } from '../payroll/payrollUtils';

interface Props {
  projectId: string;
  startDate: string | null;
  endDate: string | null;
}

interface Detail {
  expenseTotal: number;
  withholdingTax: number;
  vatPayable: number;
  salesVat: number;
  purchaseVat: number;
  netExpense: number;
  programs: Array<{ id: string; name: string; budget: number; totalExpense: number; unpaid: number }>;
}

const EMPTY: Detail = { expenseTotal: 0, withholdingTax: 0, vatPayable: 0, salesVat: 0, purchaseVat: 0, netExpense: 0, programs: [] };

export default function ProjectFinanceDetail({ projectId, startDate, endDate }: Props) {
  const [data, setData] = useState<Detail>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // 1) 프로그램 목록 (사업비 budget 컬럼은 박경수님 환경에 없음 → null 처리, 프로젝트 budget 활용)
      const { data: prgRes } = await supabase.from('programs').select('id, name')
        .eq('project_id', projectId).is('deleted_at', null).order('created_at');
      const programs = (prgRes ?? []) as Array<{ id: string; name: string }>;

      // 2) payroll_expenses (project_id OR 연결된 program_id)
      const programIds = programs.map((p) => p.id);
      let expQ = supabase.from('payroll_expenses')
        .select('subtotal, tax_amount, expense_type, program_id, payment_status, paid_at, created_at')
        .is('deleted_at', null);
      expQ = programIds.length > 0
        ? expQ.or(`project_id.eq.${projectId},program_id.in.(${programIds.join(',')})`)
        : expQ.eq('project_id', projectId);
      const { data: expRes } = await expQ;
      let exps = (expRes ?? []) as Array<{ subtotal: number | string | null; tax_amount: number | string | null; expense_type: string; program_id: string | null; payment_status: string; paid_at: string | null; created_at: string }>;
      if (startDate || endDate) {
        exps = exps.filter((r) => {
          const d = r.paid_at ?? r.created_at;
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });
      }

      // 3) income_contracts — 매출세액 계산 (vat_type='과세' 인 행의 contract_amount/11)
      const { data: conRes } = await supabase.from('income_contracts')
        .select('contract_amount, vat_type, deposited_at, program_id')
        .eq('project_id', projectId).is('deleted_at', null);
      const cons = (conRes ?? []) as Array<{ contract_amount: number | string | null; vat_type: string | null; program_id: string | null }>;

      const expenseTotal = exps.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
      const withholdingTax = exps.filter((r) => isPersonCategory(r.expense_type))
        .reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
      const purchaseVat = exps.filter((r) => !isPersonCategory(r.expense_type))
        .reduce((s, r) => s + Number(r.tax_amount ?? 0), 0);
      const salesVat = cons.filter((c) => c.vat_type === '과세')
        .reduce((s, c) => s + Math.floor(Number(c.contract_amount ?? 0) / 11), 0);
      const vatPayable = Math.max(0, salesVat - purchaseVat);
      const netExpense = expenseTotal - withholdingTax - purchaseVat;

      // 4) 프로그램별 집계
      const prgAgg = programs.map((p) => {
        const rows = exps.filter((r) => r.program_id === p.id);
        const totalExpense = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
        // STEP-PAYROLL-STATUS-FLOW — 미지급 = paid/cancelled 외 (영문 6단계)
        const unpaid = rows.filter((r) => r.payment_status !== 'paid' && r.payment_status !== 'cancelled').reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
        const budget = cons.filter((c) => c.program_id === p.id).reduce((s, c) => s + Number(c.contract_amount ?? 0), 0);
        return { id: p.id, name: p.name, budget, totalExpense, unpaid };
      });

      if (cancelled) return;
      setData({ expenseTotal, withholdingTax, vatPayable, salesVat, purchaseVat, netExpense, programs: prgAgg });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 세액 카드 3종 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <DetailCard title="순지출 (세액 제외)" value={data.netExpense} color="slate"
          sub={`지출 ${formatMoney(data.expenseTotal)} − 세액`} />
        <DetailCard title="납부 부가세 (매출 − 매입)" value={data.vatPayable} color="amber"
          sub={`매출 ${formatMoney(data.salesVat)} · 매입 ${formatMoney(data.purchaseVat)}`} />
        <DetailCard title="원천세 (인건비)" value={data.withholdingTax} color="orange"
          sub="인건비 tax_amount 합" />
      </div>

      {/* 프로그램별 집계 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">프로그램</th>
              <th className="text-right px-3 py-2.5 font-semibold">사업비</th>
              <th className="text-right px-3 py-2.5 font-semibold">지출합계</th>
              <th className="text-right px-3 py-2.5 font-semibold">미지급</th>
              <th className="text-right px-3 py-2.5 font-semibold">잔여</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.programs.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-400">프로그램이 없어요.</td></tr>
            ) : data.programs.map((p) => {
              const remaining = p.budget - p.totalExpense;
              return (
                <tr key={p.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 text-slate-700">{p.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.budget)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(p.totalExpense)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600">{formatMoney(p.unpaid)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(remaining)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const COLOR_CLASS: Record<'slate' | 'amber' | 'orange', string> = {
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
};

function DetailCard({ title, value, sub, color }: { title: string; value: number; sub: string; color: keyof typeof COLOR_CLASS }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${COLOR_CLASS[color]}`}>
      <p className="text-[11px] opacity-80 mb-0.5">{title}</p>
      <p className="text-base font-bold tabular-nums">{formatMoney(value)}</p>
      <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
    </div>
  );
}
