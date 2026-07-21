import type { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

export type CardVariant = 'flat' | 'outlined' | 'elevated';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
};

const VARIANT: Record<CardVariant, string> = {
  flat: 'bg-white',
  outlined: 'bg-white border border-slate-200',
  elevated: 'bg-white shadow-md',
};

export function Card({ variant = 'outlined', title, description, actions, className, children, ...rest }: CardProps) {
  return (
    <div className={clsx('rounded-2xl p-5', VARIANT[variant], className)} {...rest}>
      {title && <h3 className="text-lg font-semibold font-serif">{title}</h3>}
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      <div className="mt-3">{children}</div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
