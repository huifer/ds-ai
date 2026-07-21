import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type Column<T> = {
  key: keyof T & string;
  header: ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
};

export type TableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  striped?: boolean;
  bordered?: boolean;
  emptyMessage?: ReactNode;
  rowKey: (row: T) => string;
};

export function Table<T>({ rows, columns, striped, bordered, emptyMessage, rowKey }: TableProps<T>) {
  return (
    <div className={clsx('overflow-x-auto rounded-2xl border', bordered ? 'border-slate-200' : 'border-transparent')}>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={clsx('px-4 py-2 font-medium text-left', c.width ? `w-[${c.width}]` : '')}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-400">
                {emptyMessage ?? 'No data.'}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={clsx(i % 2 === 1 && striped ? 'bg-slate-50' : '')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      'px-4 py-2',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
