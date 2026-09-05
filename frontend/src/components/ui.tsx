import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { initials, titleCase } from '../lib/format';

/** App logo used in the top bar and on the auth screens. */
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-base';
  const text = size === 'lg' ? 'text-2xl' : 'text-base';
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`${box} grid place-items-center rounded-xl bg-brand-600 font-black text-white shadow-sm`}
      >
        UF
      </div>
      <div className="leading-tight">
        <div className={`${text} font-bold text-slate-900`}>Urban Furniture</div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Accounting System
        </div>
      </div>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-sky-100 text-sky-800',
  POSTED: 'bg-emerald-100 text-emerald-800',
  BILLED: 'bg-indigo-100 text-indigo-800',
  INVOICED: 'bg-indigo-100 text-indigo-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-700',
  REVISED: 'bg-amber-100 text-amber-800',
  Paid: 'bg-emerald-100 text-emerald-800',
  Unpaid: 'bg-amber-100 text-amber-800',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
  const label = status === status.toUpperCase() ? titleCase(status) : status;
  return <span className={`badge ${style}`}>{label}</span>;
}

export function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover ring-1 ring-slate-200"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="grid place-items-center rounded-full bg-brand-100 font-bold text-brand-700 ring-1 ring-brand-200"
    >
      {initials(name)}
    </div>
  );
}

export function Field({
  label,
  error,
  children,
  hint,
  className = '',
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="field">{label}</span>
      {children}
      {error ? <span className="error-text">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function TextInput({
  error,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input {...props} className={`input ${error ? 'input-error' : ''} ${className}`} />;
}

export function SelectInput({
  error,
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select {...props} className={`input ${error ? 'input-error' : ''} ${className}`}>
      {children}
    </select>
  );
}

/** Search box that only hits the server once typing pauses. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => onChange(local), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <div className="relative">
      <svg
        className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.14 3.13a.75.75 0 1 0 1.06-1.06l-3.13-3.13A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        placeholder={placeholder}
        className="input pl-8"
      />
    </div>
  );
}

/** List / Kanban switch shown at the right of the toolbar. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: 'list' | 'kanban';
  onChange: (view: 'list' | 'kanban') => void;
}) {
  const base = 'grid h-9 w-9 place-items-center rounded-md border transition';
  const active = 'border-brand-500 bg-brand-50 text-brand-700';
  const idle = 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        title="List view"
        aria-label="List view"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
        className={`${base} ${view === 'list' ? active : idle}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z" />
        </svg>
      </button>
      <button
        type="button"
        title="Kanban view"
        aria-label="Kanban view"
        aria-pressed={view === 'kanban'}
        onClick={() => onChange('kanban')}
        className={`${base} ${view === 'kanban' ? active : idle}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M3 3h6v14H3V3Zm8 0h6v8h-6V3Z" />
        </svg>
      </button>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint ? <div className="mt-1 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return <div className="px-3 py-2.5 text-xs text-slate-500">{total} record(s)</div>;
  }
  return (
    <div className="flex items-center justify-between px-3 py-2.5 text-xs text-slate-500">
      <span>
        Page {page} of {pageCount} - {total} record(s)
      </span>
      <div className="flex gap-1.5">
        <button
          type="button"
          className="btn-secondary px-2.5 py-1"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn-secondary px-2.5 py-1"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Stage bar used by the Budget form: Draft - Confirm - Revised - Cancelled. */
export function StageBar({ stages, current }: { stages: string[]; current: string }) {
  const index = stages.indexOf(current);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {stages.map((stage, position) => {
        const done = index >= 0 && position <= index;
        return (
          <span
            key={stage}
            className={`rounded-md px-3 py-1 text-xs font-semibold ${
              position === index
                ? 'bg-brand-600 text-white'
                : done
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {stage}
          </span>
        );
      })}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-1.5 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.63-1.516 2.63H3.72c-1.347 0-2.19-1.463-1.516-2.63L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
      <div>{children}</div>
    </div>
  );
}
