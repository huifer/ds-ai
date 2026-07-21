import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
};

export function FormField({ label, hint, error, required, className, id, ...rest }: FormFieldProps) {
  const reactId = useId();
  const inputId = id ?? `field-${reactId}`;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={inputId}
        className={clsx(
          'w-full rounded-lg border px-3 py-2 text-sm',
          error ? 'border-red-500' : 'border-slate-300',
          className,
        )}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
