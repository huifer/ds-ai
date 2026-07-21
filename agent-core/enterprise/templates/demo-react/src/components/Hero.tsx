import type { ReactNode } from 'react';

type Props = {
  title: string;
  tagline: string;
  badge?: string;
  cta?: { label: string; href: string };
  children?: ReactNode;
};

export function Hero({ title, tagline, badge, cta, children }: Props) {
  return (
    <div>
      <h1 className="serif text-4xl md:text-5xl font-bold mt-3">{title}</h1>
      <p className="mt-3 text-slate-300 max-w-2xl">{tagline}</p>
      <div className="mt-6 flex flex-wrap gap-3 items-center">
        {cta && (
          <a
            href={cta.href}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-400 text-slate-900 px-5 py-2 text-sm font-semibold hover:bg-cyan-300"
          >
            {cta.label}
          </a>
        )}
        {badge && (
          <span className="inline-flex items-center rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-widest">
            {badge}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
