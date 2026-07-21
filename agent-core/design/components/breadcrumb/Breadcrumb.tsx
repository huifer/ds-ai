import { Link, useLocation } from 'react-router-dom';

export type BreadcrumbItem = { label: string; to?: string };

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumb({ items }: BreadcrumbProps) {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
      <ol className="flex flex-wrap gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {it.to ? (
              <Link to={it.to} className="hover:text-slate-800">
                {it.label}
              </Link>
            ) : (
              <span className={pathname === it.to ? 'text-slate-800 font-medium' : ''}>{it.label}</span>
            )}
            {i < items.length - 1 && <span>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
