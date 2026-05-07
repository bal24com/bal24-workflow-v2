// bal24 v2 — 토스트 알림 시스템 (STEP 23)
// 우하단 고정 + 3초 자동 dismiss + 4 타입 (success/error/warning/info)
// 박경수님 디자인: rounded-[12px] + 디자인 토큰 컬러

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  show: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `toast-${Date.now()}-${nextId}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string) => {
      const id = makeId();
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, show, dismiss }),
    [toasts, show, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast는 <ToastProvider> 내부에서만 사용 가능');
  }
  const { show } = ctx;
  return useMemo<ToastApi>(
    () => ({
      success: (m) => show('success', m),
      error: (m) => show('error', m),
      warning: (m) => show('warning', m),
      info: (m) => show('info', m),
    }),
    [show],
  );
}

/** ToastContainer 가 사용 — 외부 호출 X */
export function useToastInternal() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastInternal는 <ToastProvider> 내부에서만 사용 가능');
  }
  return ctx;
}
