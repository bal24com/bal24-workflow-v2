// bal24 v2 — Button (shadcn 스타일)
// variants: primary | secondary | danger | ghost | outline
// sizes: sm | md | lg

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary/40',
  secondary: 'bg-secondary text-white hover:bg-secondary/90 focus-visible:ring-secondary/40',
  danger:    'bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/40',
  ghost:     'bg-transparent text-text hover:bg-slate-100 focus-visible:ring-primary/30',
  outline:   'bg-white text-text border border-slate-200 hover:bg-slate-50 focus-visible:ring-primary/30',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-xl',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span aria-hidden="true" className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

export default Button;
