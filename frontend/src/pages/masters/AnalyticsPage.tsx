import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { AnalyticAccount, AnalyticDetail, AnalyticType } from '../../lib/types';
import { formatDate, formatMoney, formatPercent, titleCase } from '../../lib/format';
import { useList, useRecord } from '../../hooks/useList';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { FormShell, ListShell } from '../../components/shells';
import {
  ConfirmDialog,
  EmptyState,
  Field,
  SelectInput,
  Spinner,
  StatusBadge,
  TextInput,
} from '../../components/ui';

export function AnalyticsPage() {
  const navigate = useNavigate();
  const list = useList<AnalyticAccount>('/analytics', { pageSize: 20 });
  // Cards read better than rows for analytic accounts, so kanban is the default.
  const [view, setView] = useState<'list' | 'kanban'>('kanban');

  return (
    <ListShell
      title="Analyticals"
      subtitle="Analytic accounts tag document lines so budgets can measure them."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search analytic account"
      onNew={() => navigate('/account/analytics/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      view={view}
      onView={setView}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Analytic type filter"
        >
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>
      }
      page={list.params.page}
      pageCount={list.pageCount}
      total={list.total}
      onPage={list.setPage}
    >
      {list.loading ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState title="No analytic accounts yet" hint="Use New to create one." />
      ) : view === 'list' ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10" />
                <th>
                  <button type="button" onClick={() => list.setSort('name')}>
                    Analytic Account
                  </button>
                </th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((analytic) => (
                <tr
                  key={analytic.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/analytics/${analytic.id}`)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${analytic.name}`} />
                  </td>
                  <td className="font-semibold text-slate-900">
                    {analytic.name}
                    {analytic.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={titleCase(analytic.type)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.items.map((analytic) => (
            <button
              key={analytic.id}
              type="button"
              onClick={() => navigate(`/account/analytics/${analytic.id}`)}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="font-bold text-slate-900">{analytic.name}</div>
              <div className="mt-2">
                <StatusBadge status={titleCase(analytic.type)} />
              </div>
            </button>
          ))}
        </div>
      )}
    </ListShell>
  );
}

export function AnalyticFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<AnalyticDetail>('/analytics', id);

  const [form, setForm] = useState({ name: '', type: 'EXPENSE' as AnalyticType });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (record) setForm({ name: record.name, type: record.type });
    else setForm({ name: '', type: 'EXPENSE' });
  }, [record]);

  const save = async () => {
    if (form.name.trim().length < 2) {
      setError('Analytic Account name is required');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (record) {
        await api.put(`/analytics/${record.id}`, form);
        toast.success('Analytic account saved');
        await reload();
      } else {
        const { data } = await api.post<AnalyticAccount>('/analytics', form);
        toast.success('Analytic account created');
        navigate(`/account/analytics/${data.id}`, { replace: true });
      }
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save the analytic account'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!record) return;
    setConfirmArchive(false);
    try {
      await api.post(`/analytics/${record.id}/${record.isArchived ? 'restore' : 'archive'}`);
      toast.success(record.isArchived ? 'Analytic restored' : 'Analytic archived');
      await reload();
    } catch (archiveError) {
      toast.error(errorMessage(archiveError, 'Could not archive the analytic account'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Analytic Account'}
      subtitle="Income analytics tag sales documents, expense analytics tag purchase documents."
      backTo="/account/analytics"
      onNew={() => navigate('/account/analytics/new')}
      onConfirm={() => void save()}
      confirmDisabled={busy}
      onArchive={isAdmin && record ? () => setConfirmArchive(true) : undefined}
      archiveLabel={record?.isArchived ? 'Restore' : 'Archived'}
    >
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label="Analytic Account" error={error}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={Boolean(error)}
            placeholder="Analytic Account"
          />
        </Field>
        <Field label="Type">
          <SelectInput
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as AnalyticType })}
          >
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </SelectInput>
        </Field>
      </div>

      {record ? (
        <div className="mt-7">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Budgets using this analytic account
          </h2>
          {record.budgets.length === 0 ? (
            <p className="text-sm text-slate-500">
              This analytic account is not on any budget yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="table">
                <thead>
                  <tr>
                    <th>Budget</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th className="text-right">Committed</th>
                    <th className="text-right">Achieved</th>
                    <th className="text-right">Achieved %</th>
                  </tr>
                </thead>
                <tbody>
                  {record.budgets.map((usage) => (
                    <tr
                      key={usage.budgetId}
                      className="cursor-pointer"
                      onClick={() => navigate(`/account/budgets/${usage.budgetId}`)}
                    >
                      <td className="font-semibold text-slate-900">{usage.budgetName}</td>
                      <td>{formatDate(usage.startDate)}</td>
                      <td>{formatDate(usage.endDate)}</td>
                      <td className="text-right">{formatMoney(usage.committedAmount)}</td>
                      <td className="text-right font-semibold">
                        {formatMoney(usage.achievedAmount)}
                      </td>
                      <td className="text-right">{formatPercent(usage.achievedPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmArchive}
        title={record?.isArchived ? 'Restore analytic account' : 'Archive analytic account'}
        message={
          record?.isArchived
            ? 'The analytic account will be selectable again.'
            : 'Archived analytic accounts stay on existing documents but are hidden from the pickers.'
        }
        confirmLabel={record?.isArchived ? 'Restore' : 'Archive'}
        onConfirm={() => void archive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </FormShell>
  );
}
