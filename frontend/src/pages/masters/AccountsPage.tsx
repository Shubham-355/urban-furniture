import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { Account, AccountType } from '../../lib/types';
import { titleCase } from '../../lib/format';
import { useList, useRecord } from '../../hooks/useList';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { FormShell, ListShell } from '../../components/shells';
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Spinner,
  StatusBadge,
  TextInput,
} from '../../components/ui';

/**
 * The Type dropdown groups the account types the way the reports do. The two
 * group headings are labels only and cannot be selected.
 */
const TYPE_GROUPS: { label: string; options: { value: AccountType; label: string }[] }[] = [
  {
    label: 'Balancesheet',
    options: [
      { value: 'ASSET', label: 'Asset' },
      { value: 'LIABILITY', label: 'Liability' },
      { value: 'BANK', label: 'Bank' },
      { value: 'CAPITAL', label: 'Capital' },
      { value: 'CASH', label: 'Cash' },
    ],
  },
  {
    label: 'Profit and Loss',
    options: [
      { value: 'INCOME', label: 'Income' },
      { value: 'EXPENSE', label: 'Expense' },
      { value: 'OTHER_EXPENSE', label: 'Other Expense' },
    ],
  },
];

export function AccountsPage() {
  const navigate = useNavigate();
  const list = useList<Account>('/accounts', { pageSize: 25 });

  return (
    <ListShell
      title="Chart of Account"
      subtitle="Every transaction reaches the reports through these accounts."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search account name"
      onNew={() => navigate('/account/chart-of-accounts/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Account group filter"
        >
          <option value="">All accounts</option>
          <option value="BALANCESHEET">Balancesheet</option>
          <option value="PROFIT_AND_LOSS">Profit and Loss</option>
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
        <EmptyState title="No accounts" hint="Run the seed or use New to add one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => list.setSort('name')}>
                    Account Name
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => list.setSort('type')}>
                    Type
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((account) => (
                <tr
                  key={account.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/chart-of-accounts/${account.id}`)}
                >
                  <td className="font-semibold text-slate-900">
                    {account.name}
                    {account.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={titleCase(account.type)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}

export function AccountFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<Account>('/accounts', id);

  const [form, setForm] = useState({ name: '', type: '' as AccountType | '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (record) setForm({ name: record.name, type: record.type });
    else setForm({ name: '', type: '' });
  }, [record]);

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = 'Account Name is required';
    if (!form.type) nextErrors.type = 'Choose a type';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (record) {
        await api.put(`/accounts/${record.id}`, form);
        toast.success('Account saved');
        await reload();
      } else {
        const { data } = await api.post<Account>('/accounts', form);
        toast.success('Account created');
        navigate(`/account/chart-of-accounts/${data.id}`, { replace: true });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the account'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!record) return;
    setConfirmArchive(false);
    try {
      await api.post(`/accounts/${record.id}/${record.isArchived ? 'restore' : 'archive'}`);
      toast.success(record.isArchived ? 'Account restored' : 'Account archived');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not archive the account'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Account'}
      subtitle="The type decides how the account is treated and where it appears in the reports."
      backTo="/account/chart-of-accounts"
      onNew={() => navigate('/account/chart-of-accounts/new')}
      onConfirm={() => void save()}
      confirmDisabled={busy}
      onArchive={isAdmin && record ? () => setConfirmArchive(true) : undefined}
      archiveLabel={record?.isArchived ? 'Restore' : 'Archived'}
    >
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        <Field label="Account Name" error={errors.name}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={Boolean(errors.name)}
            placeholder="Account Name"
          />
        </Field>

        <Field label="Type" error={errors.type}>
          <select
            className={`input w-full ${errors.type ? 'input-error' : ''}`}
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as AccountType })}
          >
            <option value="">Select a type</option>
            {TYPE_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={record?.isArchived ? 'Restore account' : 'Archive account'}
        message={
          record?.isArchived
            ? 'The account will be selectable again.'
            : 'Archived accounts stay on posted entries but are hidden from the pickers.'
        }
        confirmLabel={record?.isArchived ? 'Restore' : 'Archive'}
        onConfirm={() => void archive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </FormShell>
  );
}
