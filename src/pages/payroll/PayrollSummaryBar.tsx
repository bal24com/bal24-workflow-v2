// 외주/급여 합계 바 — 세전·원천세·실지급 + 건수
// STEP-ACCOUNTING-ALL P3

import { formatMoney } from '../../lib/utils';
import type { PayrollSummary } from './payrollUtils';

interface Props {
  summary: PayrollSummary;
}

export default function PayrollSummaryBar({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Cell label="건수" value={`${summary.count}건`} tone="slate" />
      <Cell label="세전 합계" value={formatMoney(summary.subtotal)} tone="text" />
      <Cell label="원천세 합계" value={formatMoney(summary.taxAmount)} tone="rose" />
      <Cell label="실지급 합계" value={formatMoney(summary.netAmount)} tone="violet" highlight />
    </div>
  );
}

function Cell({
  label, value, tone, highlight,
}: { label: string; value: string; tone: 'slate' | 'text' | 'rose' | 'violet'; highlight?: boolean }) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-600',
    text: 'text-text',
    rose: 'text-rose-600',
    violet: 'text-violet-700',
  };
  return (
    <div className={`rounded-2xl border p-3 ${highlight ? 'bg-violet-50/40 border-violet-200' : 'bg-white border-slate-200'}`}>
      <div className="text-[11px] text-slate-500 font-semibold">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${colorMap[tone]}`}>{value}</div>
    </div>
  );
}
