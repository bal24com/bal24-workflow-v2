// bal24 v2 — Modal (shadcn 스타일, 기본형)
// 백드롭 클릭 닫기 + ESC 닫기 + body scroll lock + 포커스 진입

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * 모달 size variants:
 *  - sm/md/lg: 기존 (Tailwind max-w-* + rounded-2xl + shadow-xl)
 *  - brand: 박경수님 디자인 시스템 (max-w-[560px] + rounded-[20px] + 강한 shadow)
 *    Q2=B 결정 — 기존 유지 + 신규 variant 추가, 점진 마이그레이션.
 */
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'brand';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  // 박경수님 + SkyClaw STEP-PAYROLL-UI-FIX (2026-05-28) — 외주/급여 수정 모달용 더 넓은 사이즈
  xl: 'max-w-4xl',
  brand: 'max-w-[560px]',
};

const ROUNDED_CLASS: Record<Size, string> = {
  sm: 'rounded-2xl',
  md: 'rounded-2xl',
  lg: 'rounded-2xl',
  xl: 'rounded-2xl',
  brand: 'rounded-[20px]',
};

const SHADOW_CLASS: Record<Size, string> = {
  sm: 'shadow-xl',
  md: 'shadow-xl',
  lg: 'shadow-xl',
  xl: 'shadow-xl',
  brand: 'shadow-[0_20px_60px_rgba(30,27,75,0.15)]',
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: Size;
  closeOnBackdrop?: boolean;
  hideCloseButton?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  hideCloseButton = false,
  children,
  footer,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // 박경수님 요청 — 모달 내부에서 텍스트 드래그 시작 후 백드롭에서 떼면 닫히는 버그 방지.
  // mousedown 이 백드롭에서 시작된 경우만 백드롭 클릭으로 인정.
  const mouseDownOnBackdropRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialogRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        // 드래그 시작 위치가 백드롭(currentTarget) 자체일 때만 기록
        mouseDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // mousedown·mouseup 모두 백드롭에서 일어났을 때만 닫기 (드래그로 닫힘 방지)
        const startedOnBackdrop = mouseDownOnBackdropRef.current;
        mouseDownOnBackdropRef.current = false;
        if (closeOnBackdrop && startedOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-desc' : undefined}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative w-full bg-white outline-none flex flex-col max-h-[90vh]',
          SIZE_CLASS[size],
          ROUNDED_CLASS[size],
          SHADOW_CLASS[size],
          className,
        )}
      >
        {(title || !hideCloseButton) && (
          <header className="flex items-start justify-between gap-4 p-5 pb-3">
            <div className="space-y-1">
              {title && (
                <h2 id="modal-title" className="text-lg font-bold text-text">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="text-slate-400 hover:text-slate-700 rounded-lg p-1 -mt-1 -mr-1 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}

        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 p-5 pt-3 border-t border-slate-100">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
