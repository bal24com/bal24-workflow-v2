// bal24 v2 — 외부공유 항목 카드 공용 셸 (Stage 3-B-2-①)

import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  hint?: string;
  children: ReactNode;
}

export default function ItemCard({ icon, title, hint, children }: Props) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[#1E1B4B] leading-snug">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{hint}</p>}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}
