// bal24 v2 — Input (shadcn 스타일)
// label / error / helper / leftIcon / rightSlot 지원

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  helperText?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, leftIcon, rightSlot, id, className, type = 'text', ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedById = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={describedById}
          className={cn(
            'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition disabled:opacity-60',
            'focus:ring-2',
            hasError
              ? 'border-danger/60 focus:border-danger focus:ring-danger/20'
              : 'border-slate-200 focus:border-primary focus:ring-primary/20',
            leftIcon ? 'pl-10' : '',
            rightSlot ? 'pr-11' : '',
            className,
          )}
          {...rest}
        />

        {rightSlot && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-2">
            {rightSlot}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-help`} className="text-xs text-muted">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

export default Input;
