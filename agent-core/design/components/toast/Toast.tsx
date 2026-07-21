import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

type ToastVariant = 'info' | 'success' | 'warn' | 'danger';

type Toast = { id: number; title: string; description?: string; variant: ToastVariant };
type ToastInput = Omit<Toast, 'id'>;

type ToastContextValue = {
  push: (t: ToastInput) => void;
};

const Ctx = createContext<ToastContextValue | null>(null);

const COLOR: Record<ToastVariant, string> = {
  info: 'bg-cyan-50 border-cyan-200 text-cyan-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warn: 'bg-amber-50 border-amber-200 text-amber-900',
  danger: 'bg-red-50 border-red-200 text-red-900',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 4000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx('rounded-xl border px-4 py-2 text-sm shadow-md w-80', COLOR[t.variant])}
          >
            <p className="font-semibold">{t.title}</p>
            {t.description && <p className="mt-1 text-xs">{t.description}</p>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}
