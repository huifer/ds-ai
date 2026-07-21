import type { ReactNode } from 'react';
import { clsx } from 'clsx';

export type HeroAlign = 'left' | 'center' | 'split';

export type HeroProps = {
  title: ReactNode;
  tagline?: ReactNode;
  badge?: ReactNode;
  cta?: ReactNode;
  side?: ReactNode;
  align?: HeroAlign;
  className?: string;
};

export function Hero({ title, tagline, badge, cta, side, align = 'left', className }: HeroProps) {
  return (
    <section
      className={clsx(
        'rounded-2xl bg-brand-primary text-white px-6 py-10',
        align === 'center' && 'text-center',
        align === 'split' && 'grid md:grid-cols-2 gap-6 items-center',
        className,
      )}
    >
      <div>
        {badge && <p className="text-xs uppercase tracking-widest text-cyan-200">{badge}</p>}
        <h1 className="font-serif text-3xl md:text-4xl font-bold mt-2">{title}</h1>
        {tagline && <p className="mt-2 text-slate-300 max-w-2xl">{tagline}</p>}
        {cta && <div className="mt-4 flex flex-wrap gap-2">{cta}</div>}
      </div>
      {side && <div>{side}</div>}
    </section>
  );
}
