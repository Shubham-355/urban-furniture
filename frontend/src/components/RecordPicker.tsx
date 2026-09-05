import { useEffect, useMemo, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { ListResponse } from '../lib/types';
import { useToast } from '../app/ToastContext';

interface Option {
  id: number;
  name: string;
}

/**
 * Many-to-one picker used everywhere the mockup shows a relation field.
 * It searches on the server as you type and can optionally create a record
 * from whatever was typed - that is how "Create '<typed>'" works on the
 * product Category dropdown.
 */
export function RecordPicker<T extends Option>({
  endpoint,
  value,
  onChange,
  params,
  placeholder = 'Select...',
  disabled = false,
  error = false,
  allowCreate = false,
  createLabel = (typed: string) => `Create "${typed}"`,
  renderOption,
  emptyLabel = 'No records found',
}: {
  endpoint: string;
  value: number | null;
  onChange: (id: number | null, record: T | null) => void;
  params?: Record<string, string | undefined>;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  allowCreate?: boolean;
  createLabel?: (typed: string) => string;
  renderOption?: (option: T) => React.ReactNode;
  emptyLabel?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [selected, setSelected] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const query = useMemo(() => JSON.stringify(params ?? {}), [params]);

  // Load the current value so the closed field shows its name.
  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    api
      .get<T>(`${endpoint}/${value}`)
      .then(({ data }) => {
        if (!cancelled) setSelected(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, endpoint]);

  // Search the server while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      api
        .get<ListResponse<T>>(endpoint, {
          params: { search, pageSize: 20, archived: 'false', ...(params ?? {}) },
        })
        .then(({ data }) => {
          if (!cancelled) setOptions(data.items);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, endpoint, query]);

  // Close when clicking away.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const choose = (option: T | null) => {
    setSelected(option);
    onChange(option?.id ?? null, option);
    setOpen(false);
    setSearch('');
  };

  const create = async () => {
    const name = search.trim();
    if (!name) return;
    try {
      const { data } = await api.post<T>(endpoint, { name });
      toast.success(`"${data.name}" created`);
      choose(data);
    } catch (creationError) {
      toast.error(errorMessage(creationError, 'Could not create the record'));
    }
  };

  const exactMatch = options.some((option) => option.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`input flex w-full items-center justify-between text-left ${error ? 'input-error' : ''} ${
          disabled ? 'cursor-not-allowed bg-slate-100' : ''
        }`}
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <span className="ml-2 flex items-center gap-1">
          {selected && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(event) => {
                event.stopPropagation();
                choose(null);
              }}
              className="rounded px-1 text-slate-400 hover:text-rose-600"
            >
              &times;
            </span>
          ) : null}
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type to search..."
              className="input w-full py-1.5 text-sm"
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1 text-sm">
            {loading ? <li className="px-3 py-2 text-slate-400">Searching...</li> : null}
            {!loading && options.length === 0 ? (
              <li className="px-3 py-2 text-slate-400">{emptyLabel}</li>
            ) : null}
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => choose(option)}
                  className={`block w-full px-3 py-2 text-left hover:bg-brand-50 ${
                    option.id === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700'
                  }`}
                >
                  {renderOption ? renderOption(option) : option.name}
                </button>
              </li>
            ))}
            {allowCreate && search.trim() && !exactMatch ? (
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={create}
                  className="block w-full px-3 py-2 text-left font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {createLabel(search.trim())}
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
