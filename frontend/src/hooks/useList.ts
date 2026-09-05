import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { ListParams } from '../lib/api';
import type { ListResponse } from '../lib/types';
import { useToast } from '../app/ToastContext';

/**
 * Shared behaviour behind every list view: debounced server side search,
 * paging, sorting and the archived filter.
 */
export function useList<T>(endpoint: string, initial: ListParams = {}) {
  const toast = useToast();
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<ListParams>({
    page: 1,
    pageSize: 25,
    search: '',
    archived: 'false',
    ...initial,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ListResponse<T>>(endpoint, { params });
      setItems(data.items);
      setTotal(data.total);
      setPageCount(data.pageCount);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the list'));
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params)]);

  useEffect(() => {
    void load();
  }, [load]);

  const setSearch = useCallback((search: string) => {
    setParams((current) => ({ ...current, search, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setParams((current) => ({ ...current, page }));
  }, []);

  const setStatus = useCallback((status: string | undefined) => {
    setParams((current) => ({ ...current, status, page: 1 }));
  }, []);

  const setArchived = useCallback((archived: 'true' | 'false' | 'all') => {
    setParams((current) => ({ ...current, archived, page: 1 }));
  }, []);

  const setSort = useCallback((sortBy: string) => {
    setParams((current) => ({
      ...current,
      sortBy,
      sortDir: current.sortBy === sortBy && current.sortDir === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  return {
    items,
    total,
    pageCount,
    loading,
    params,
    setSearch,
    setPage,
    setStatus,
    setArchived,
    setSort,
    reload: load,
  };
}

/** Load a single record by id, or nothing when creating a new one. */
export function useRecord<T>(endpoint: string, id: string | undefined) {
  const toast = useToast();
  const [record, setRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(id) && id !== 'new');

  const load = useCallback(async () => {
    if (!id || id === 'new') {
      setRecord(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get<T>(`${endpoint}/${id}`);
      setRecord(data);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the record'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { record, setRecord, loading, reload: load };
}
