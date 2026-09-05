import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pagination, SearchInput, ViewToggle } from './ui';

/**
 * Toolbar + body used by every list view: search on the left, optional filter
 * chips, and New / Back / Archived / view-toggle on the right.
 */
export function ListShell({
  title,
  subtitle,
  search,
  onSearch,
  searchPlaceholder,
  onNew,
  newLabel = 'New',
  archived,
  onArchived,
  view,
  onView,
  filters,
  extraActions,
  page,
  pageCount,
  total,
  onPage,
  children,
}: {
  title: string;
  subtitle?: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  onNew?: () => void;
  newLabel?: string;
  archived?: 'true' | 'false' | 'all';
  onArchived?: (value: 'true' | 'false' | 'all') => void;
  view?: 'list' | 'kanban';
  onView?: (view: 'list' | 'kanban') => void;
  filters?: ReactNode;
  extraActions?: ReactNode;
  page?: number;
  pageCount?: number;
  total?: number;
  onPage?: (page: number) => void;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onNew ? (
            <button type="button" className="btn-primary" onClick={onNew}>
              {newLabel}
            </button>
          ) : null}
          {extraActions}
          {onArchived ? (
            <select
              className="input w-auto py-2"
              value={archived ?? 'false'}
              onChange={(event) => onArchived(event.target.value as 'true' | 'false' | 'all')}
              aria-label="Archived filter"
            >
              <option value="false">Active</option>
              <option value="true">Archived</option>
              <option value="all">All</option>
            </select>
          ) : null}
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
          {view && onView ? <ViewToggle view={view} onChange={onView} /> : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} />
        </div>
        {filters}
      </div>

      <div className="card overflow-hidden">
        {children}
        {page && pageCount && onPage ? (
          <Pagination page={page} pageCount={pageCount} total={total ?? 0} onChange={onPage} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Form view frame. The button row matches the mockup: New, Confirm, Back and -
 * for an Admin - Archived, plus whatever extra actions a document needs.
 */
export function FormShell({
  title,
  subtitle,
  status,
  stage,
  onNew,
  onConfirm,
  confirmLabel = 'Confirm',
  confirmDisabled = false,
  onArchive,
  archiveLabel = 'Archived',
  backTo,
  actions,
  smartButtons,
  banner,
  children,
}: {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  stage?: ReactNode;
  onNew?: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onArchive?: () => void;
  archiveLabel?: string;
  backTo: string;
  actions?: ReactNode;
  smartButtons?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {status}
          </div>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          {stage ? <div className="mt-2">{stage}</div> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {smartButtons}
          {onNew ? (
            <button type="button" className="btn-secondary" onClick={onNew}>
              New
            </button>
          ) : null}
          {actions}
          {onConfirm ? (
            <button
              type="button"
              className="btn-primary"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          ) : null}
          {onArchive ? (
            <button type="button" className="btn-danger" onClick={onArchive}>
              {archiveLabel}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={() => navigate(backTo)}>
            Back
          </button>
        </div>
      </div>

      {banner}

      <div className="card p-5">{children}</div>
    </div>
  );
}

/** Small pill button used for the smart buttons at the top right of a document. */
export function SmartButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      {value ? <div className="text-sm font-semibold text-slate-800">{value}</div> : null}
    </button>
  );
}
