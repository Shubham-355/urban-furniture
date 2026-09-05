import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { Account, Journal, JournalType } from '../../lib/types';
import { titleCase } from '../../lib/format';
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
import { RecordPicker } from '../../components/RecordPicker';

export function JournalsPage() {
  const navigate = useNavigate();
  const list = useList<Journal>('/journals', { pageSize: 25 });

  return (
    <ListShell
      title="Journals"
      subtitle="Each journal groups the entries produced by one kind of document."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search journal name"
      onNew={() => navigate('/account/journals/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      page={list.params.page}
      pageCount={list.pageCount}
      total={list.total}
      onPage={list.setPage}
    >
      {list.loading ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState title="No journals" hint="Run the seed or use New to add one." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => list.setSort('name')}>
                    Journal Name
                  </button>
                </th>
                <th>Type</th>
                <th>Default Account</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((journal) => (
                <tr
                  key={journal.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/journals/${journal.id}`)}
                >
                  <td className="font-semibold text-slate-900">
                    {journal.name}
                    {journal.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={titleCase(journal.type)} />
                  </td>
                  <td>{journal.defaultAccount?.name ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}

export function JournalFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<Journal>('/journals', id);

  const [form, setForm] = useState({
    name: '',
    type: 'SALES' as JournalType,
    defaultAccountId: null as number | null,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({ name: record.name, type: record.type, defaultAccountId: record.defaultAccountId });
    } else {
      setForm({ name: '', type: 'SALES', defaultAccountId: null });
    }
  }, [record]);

  const save = async () => {
    if (form.name.trim().length < 2) {
      setError('Journal Name is required');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (record) {
        await api.put(`/journals/${record.id}`, form);
        toast.success('Journal saved');
        await reload();
      } else {
        const { data } = await api.post<Journal>('/journals', form);
        toast.success('Journal created');
        navigate(`/account/journals/${data.id}`, { replace: true });
      }
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Could not save the journal'));
    } finally {
      setBusy(false);
    }
  };

  const archive = async () => {
    if (!record) return;
    setConfirmArchive(false);
    try {
      await api.post(`/journals/${record.id}/${record.isArchived ? 'restore' : 'archive'}`);
      toast.success(record.isArchived ? 'Journal restored' : 'Journal archived');
      await reload();
    } catch (archiveError) {
      toast.error(errorMessage(archiveError, 'Could not archive the journal'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Journal'}
      backTo="/account/journals"
      onNew={() => navigate('/account/journals/new')}
      onConfirm={() => void save()}
      confirmDisabled={busy}
      onArchive={isAdmin && record ? () => setConfirmArchive(true) : undefined}
      archiveLabel={record?.isArchived ? 'Restore' : 'Archived'}
    >
      <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
        <Field label="Journal Name" error={error}>
          <TextInput
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            error={Boolean(error)}
            placeholder="Journal Name"
          />
        </Field>

        <Field label="Journal Type">
          <SelectInput
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value as JournalType })}
          >
            <option value="SALES">Sales</option>
            <option value="PURCHASE">Purchase</option>
            <option value="BANK">Bank</option>
            <option value="CASH">Cash</option>
          </SelectInput>
        </Field>

        <Field label="Default Account">
          <RecordPicker<Account>
            endpoint="/accounts"
            value={form.defaultAccountId}
            onChange={(defaultAccountId) => setForm({ ...form, defaultAccountId })}
            placeholder="Select an account"
          />
        </Field>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        title={record?.isArchived ? 'Restore journal' : 'Archive journal'}
        message={
          record?.isArchived
            ? 'The journal will be selectable again.'
            : 'Archived journals keep their posted entries but are hidden from the pickers.'
        }
        confirmLabel={record?.isArchived ? 'Restore' : 'Archive'}
        onConfirm={() => void archive()}
        onCancel={() => setConfirmArchive(false)}
      />
    </FormShell>
  );
}
