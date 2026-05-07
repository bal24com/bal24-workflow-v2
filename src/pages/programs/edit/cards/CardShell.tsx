// bal24 v2 — 프로그램 수정 풀 페이지 공용 카드 셸
// 번호 + 제목 + (선택) 액션 영역 + 본문.

import type { ReactNode } from 'react';

interface Props {
  step: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function CardShell({ step, title, description, actions, children }: Props) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0">
          <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-md bg-violet-100 text-violet-700 text-xs font-bold tabular-nums shrink-0">
            {step}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#1E1B4B]">{title}</h3>
            {description && (
              <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Field({
  label, required, children, hint,
}: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

export const textareaClass = `${inputClass} min-h-[88px] resize-y leading-relaxed`;
