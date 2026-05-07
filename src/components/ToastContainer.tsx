// bal24 v2 — 토스트 알림 컨테이너 (STEP 23)
// 우하단 고정 + 4 타입 색상 + rounded-[12px] + 자동 dismiss 3초

import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useToastInternal, type ToastType } from '../contexts/ToastContext';

const TYPE_STYLE: Record<ToastType, { bg: string; text: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-800',
    icon: <CheckCircle2 size={18} className="text-emerald-500 shrink-0" aria-hidden="true" />,
  },
  error: {
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-800',
    icon: <AlertCircle size={18} className="text-rose-500 shrink-0" aria-hidden="true" />,
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-800',
    icon: <AlertTriangle size={18} className="text-amber-500 shrink-0" aria-hidden="true" />,
  },
  info: {
    bg: 'bg-violet-50 border-violet-200',
    text: 'text-violet-800',
    icon: <Info size={18} className="text-violet-600 shrink-0" aria-hidden="true" />,
  },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToastInternal();

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="알림"
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const tone = TYPE_STYLE[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 min-w-[280px] max-w-[420px] rounded-[12px] border ${tone.bg} px-4 py-3 shadow-[0_8px_24px_rgba(30,27,75,0.12)] animate-[fadeInUp_180ms_ease-out]`}
          >
            {tone.icon}
            <p className={`flex-1 text-sm font-medium ${tone.text} break-words`}>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="알림 닫기"
              className={`shrink-0 rounded p-0.5 ${tone.text} opacity-50 hover:opacity-100 transition-opacity`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
