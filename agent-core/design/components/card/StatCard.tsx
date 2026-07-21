import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type StatCardProps = {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div className={clsx('rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-md', className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {delta && <p className="text-xs text-slate-500 mt-1">{delta}</p>}
    </div>
  );
}
