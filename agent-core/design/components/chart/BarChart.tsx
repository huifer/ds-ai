import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type BarDatum = { label: string; value: number; note?: ReactNode };

export type BarChartProps = {
  data: BarDatum[];
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
};

export function BarChart({ data, height = 220, formatValue = (n) => String(n), className }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={clsx('rounded-2xl bg-white p-4 border border-slate-200', className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col justify-end items-center">
            <div
              className="w-full rounded-t-md bg-brand-accent"
              style={{ height: `${(d.value / max) * 100}%` }}
              aria-label={`${d.label}: ${formatValue(d.value)}`}
            />
            <div className="mt-2 text-[10px] text-slate-500 truncate w-full text-center">{d.label}</div>
            <div className="text-[10px] text-slate-400 truncate w-full text-center">{formatValue(d.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
