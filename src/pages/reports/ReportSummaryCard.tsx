// bal24 v2 — 재무 리포트 KPI 카드 (STEP 20)

import type { ReactNode } from 'react';

type Tone = 'violet' | 'orange' | 'mint' | 'red' | 'green' | 'gray';

const TONE: Record<Tone, { value: string; ring: string; iconBg: string }> = {
  violet: { value: 'text-violet-700', ring: 'border-violet-100', iconBg: 'bg-violet-100 text-violet-600' },
  orange: { value: 'text-orange-700', ring: 'border-orange-100', iconBg: 'bg-orange-100 text-orange-600' },
  mint: { value: 'text-cyan-700', ring: 'border-cyan-100', iconBg: 'bg-cyan-100 text-cyan-600' },
  red: { value: 'text-rose-700', ring: 'border-rose-100', iconBg: 'bg-rose-100 text-rose-600' },
  green: { value: 'text-emerald-700', ring: 'border-emerald-100', iconBg: 'bg-emerald-100 text-emerald-600' },
  gray: { value: 'text-slate-700', ring: 'border-slate-200', iconBg: 'bg-slate-100 text-slate-600' },
};

interface Props {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: ReactNode;
}

export default function ReportSummaryCard({ label, value, sub, tone = 'violet', icon }: Props) {
  const t = TONE[tone];
  return (
    <div
      className={`rounded-2xl border ${t.ring} bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2`}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${t.iconBg}`}>
            {icon}
          </span>
        )}
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${t.value}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
