// bal24 v2 — Card (shadcn 스타일, 컴포지션 패턴)
// Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter

import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type DivProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, DivProps>(function Card(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-card rounded-card border border-[#EDE9FE] shadow-card',
        className,
      )}
      {...rest}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, DivProps>(function CardHeader(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cn('p-5 pb-3 space-y-1', className)} {...rest} />;
});

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...rest }, ref) {
    return (
      <h3
        ref={ref}
        className={cn('text-base font-bold text-text', className)}
        {...rest}
      />
    );
  },
);

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription({ className, ...rest }, ref) {
    return <p ref={ref} className={cn('text-xs text-muted', className)} {...rest} />;
  },
);

export const CardContent = forwardRef<HTMLDivElement, DivProps>(function CardContent(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cn('p-5 pt-2', className)} {...rest} />;
});

export const CardFooter = forwardRef<HTMLDivElement, DivProps>(function CardFooter(
  { className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn('p-5 pt-3 border-t border-slate-100 flex items-center', className)}
      {...rest}
    />
  );
});

export default Card;
