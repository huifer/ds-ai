import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

type Heading = { id: string; text: ReactNode; level?: 1 | 2 | 3 };

export type TableOfContentsProps = {
  headings: Heading[];
  variant?: 'sidebar' | 'top';
  className?: string;
};

export function TableOfContents({ headings, variant = 'sidebar', className }: TableOfContentsProps) {
  const { hash } = useLocation();
  return (
    <nav
      aria-label="On this page"
      className={clsx(
        'text-sm text-slate-500',
        variant === 'sidebar' ? 'sticky top-6 space-y-1' : 'flex flex-wrap gap-3',
        className,
      )}
    >
      {headings.map((h) => (
        <Link
          key={h.id}
          to={`#${h.id}`}
          className={clsx(
            'block hover:text-slate-800',
            h.level === 1 && 'font-medium',
            h.level === 2 && 'pl-3',
            h.level === 3 && 'pl-6',
            hash === `#${h.id}` && 'text-brand-primary',
          )}
        >
          {h.text}
        </Link>
      ))}
    </nav>
  );
}
