import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

export type NavItem = { label: string; to: string; end?: boolean };

export type NavProps = {
  items: NavItem[];
  className?: string;
};

export function Nav({ items, className }: NavProps) {
  return (
    <nav className={clsx('flex flex-wrap gap-2', className)}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            clsx(
              'rounded-full px-3 py-1 text-sm transition',
              isActive
                ? 'bg-brand-accent text-slate-900'
                : 'border border-white/30 text-white hover:bg-white/10',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
