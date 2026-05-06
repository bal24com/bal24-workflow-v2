// bal24 v2 — Badge (shadcn 스타일)
// 디자인 토큰: 바이올렛 #7C3AED / 주황 #F97316 / 민트 #06B6D4
// variants: default | primary | secondary | accent | success | warning | danger

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

const VARIANT_CLASS: Record<Variant, string> = {
  default:   'bg-slate-100 text-slate-700',
  primary:   'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent:    'bg-accent/10 text-accent',
  success:   'bg-success/10 text-success',
  warning:   'bg-warning/10 text-warning',
  danger:    'bg-danger/10 text-danger',
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'default', className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold',
        VARIANT_CLASS[variant],
        className,
      )}
      {...rest}
    />
  );
});

export default Badge;
