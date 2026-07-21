import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  size?: ModalSize;
};

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  fullscreen: 'max-w-[95vw] h-[90vh]',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' ? onClose() : undefined);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className={clsx('w-full rounded-2xl bg-white shadow-2xl', SIZE[size])}>
        {title && (
          <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{title}</h3>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              ×
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
