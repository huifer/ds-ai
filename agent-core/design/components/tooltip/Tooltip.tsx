import { useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

type Side = 'top' | 'bottom' | 'left' | 'right';

export type TooltipProps = {
  label: ReactNode;
  children: ReactNode;
  side?: Side;
  className?: string;
};

const POS: Record<Side, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={clsx('relative inline-block', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={clsx('absolute z-10 whitespace-nowrap rounded-md bg-slate-900 text-white text-xs px-2 py-1', POS[side])}
        >
          {label}
        </span>
      )}
    </span>
  );
}
