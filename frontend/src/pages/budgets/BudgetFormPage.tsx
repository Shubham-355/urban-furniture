import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import type { AchievedDocument, AnalyticAccount, Budget, Contact } from '../../lib/types';
import { budgetSchema, validate } from '../../lib/validation';
import { formatDate, formatMoney, formatPercent, titleCase, toDateInput } from '../../lib/format';
import { useRecord } from '../../hooks/useList';
import { useAuth } from '../../app/AuthContext';
import { useToast } from '../../app/ToastContext';
import { FormShell } from '../../components/shells';
import {
  ConfirmDialog,
  Field,
  Spinner,
  StageBar,
  StatusBadge,
  TextInput,
} from '../../components/ui';
import { RecordPicker } from '../../components/RecordPicker';

const STAGES = ['Draft', 'Confirm', 'Revised', 'Cancelled'];
const STAGE_FOR: Record<string, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirm',
  REVISED: 'Revised',
  CANCELLED: 'Cancelled',
};

interface DraftLine {
  key: string;
  id?: number;
  analyticId: number | null;
  analyticType: 'INCOME' | 'EXPENSE' | null;
  analyticName: string;
  committedAmount: number;
  achievedAmount: number;
  achievedPercent: number;
  amountToAchieve: number;
}

const emptyLine = (): DraftLine => ({
  key: Math.random().toString(36).slice(2),
  analyticId: null,
  analyticType: null,
  analyticName: '',
  committedAmount: 0,
  achievedAmount: 0,
  achievedPercent: 0,
  amountToAchieve: 0,
});

export function BudgetFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { record, loading, reload } = useRecord<Budget>('/budgets', id);

  const [header, setHeader] = useState({
    name: '',
    startDate: '',
    endDate: '',
    responsibleId: null as number | null,
  });
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [drilldown, setDrilldown] = useState<{
    title: string;
    documents: AchievedDocument[];
  } | null>(null);

  const editable = !record || record.status === 'DRAFT';
  const confirmed = record?.status === 'CONFIRMED';
  const showAchieved = Boolean(record && record.status !== 'DRAFT');

  useEffect(() => {
    if (!record) {
      setHeader({ name: '', startDate: '', endDate: '', responsibleId: null });
      setLines([emptyLine()]);
      return;
    }
    setHeader({
      name: record.name,
      startDate: toDateInput(record.startDate),
      endDate: toDateInput(record.endDate),
      responsibleId: record.responsibleId,
    });
    setLines(
      record.lines.map((line) => ({
        key: String(line.id),
        id: line.id,
        analyticId: line.analyticId,
        analyticType: line.analytic.type,
        analyticName: line.analytic.name,
        committedAmount: line.committedAmount,
        achievedAmount: line.achievedAmount,
        achievedPercent: line.achievedPercent,
        amountToAchieve: line.amountToAchieve,
      })),
    );
  }, [record]);

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const save = async (): Promise<Budget | null> => {
    const result = validate(budgetSchema, header);
    const nextErrors = result.ok ? {} : result.errors;
    const payloadLines = lines
      .filter((line) => line.analyticId)
      .map((line) => ({
        analyticId: line.analyticId,
        committedAmount: Number(line.committedAmount) || 0,
      }));
    if (payloadLines.length === 0) nextErrors.lines = 'Add at least one budget line';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return null;
    }
    setErrors({});
    setBusy(true);
    try {
      const payload = { ...header, lines: payloadLines };
      if (record) {
        const { data } = await api.put<Budget>(`/budgets/${record.id}`, payload);
        toast.success('Budget saved');
        await reload();
        return data;
      }
      const { data } = await api.post<Budget>('/budgets', payload);
      toast.success('Budget created');
      navigate(`/account/budgets/${data.id}`, { replace: true });
      return data;
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the budget'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const action = async (path: string, message: string, goTo?: (budget: Budget) => string) => {
    if (!record) return;
    try {
      const { data } = await api.post<Budget>(`/budgets/${record.id}/${path}`);
      toast.success(message);
      if (goTo) navigate(goTo(data));
      else await reload();
    } catch (error) {
      toast.error(errorMessage(error, 'The action could not be completed'));
    }
  };

  const openAchieved = async (line: DraftLine) => {
    if (!record || !line.id) return;
    try {
      const { data } = await api.get<{ documents: AchievedDocument[] }>(
        `/budgets/${record.id}/lines/${line.id}/achieved-documents`,
      );
      setDrilldown({
        title: `${line.analyticName} - ${formatDate(record.startDate)} to ${formatDate(record.endDate)}`,
        documents: data.documents,
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load the documents'));
    }
  };

  if (loading) return <Spinner />;

  return (
    <FormShell
      title={record ? record.name : 'New Budget'}
      subtitle="Committed amounts are entered; achieved amounts come from confirmed invoices and bills."
      status={record ? <StatusBadge status={record.status} /> : null}
      stage={<StageBar stages={STAGES} current={STAGE_FOR[record?.status ?? 'DRAFT']} />}
      backTo="/account/budgets"
      onNew={() => navigate('/account/budgets/new')}
      onConfirm={editable ? () => void save() : undefined}
      confirmLabel="Save"
      confirmDisabled={busy}
      onArchive={
        isAdmin && record && record.status !== 'CANCELLED'
          ? () => setConfirmCancel(true)
          : undefined
      }
      archiveLabel="Archived"
      actions={
        <>
          {record && record.status === 'DRAFT' ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void action('confirm', 'Budget confirmed')}
            >
              Confirm
            </button>
          ) : null}
          {confirmed ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                void action('revise', 'Revision created', (budget) => `/account/budgets/${budget.id}`)
              }
            >
              Revise
            </button>
          ) : null}
          {record && record.status !== 'CANCELLED' ? (
            <button type="button" className="btn-secondary" onClick={() => setConfirmCancel(true)}>
              Cancel
            </button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Budget Name" error={errors.name}>
          <TextInput
            value={header.name}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, name: event.target.value })}
            error={Boolean(errors.name)}
            placeholder="Budget Name"
          />
        </Field>
        <Field label="Start Date" error={errors.startDate}>
          <TextInput
            type="date"
            value={header.startDate}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, startDate: event.target.value })}
            error={Boolean(errors.startDate)}
          />
        </Field>
        <Field label="End Date" error={errors.endDate}>
          <TextInput
            type="date"
            value={header.endDate}
            disabled={!editable}
            onChange={(event) => setHeader({ ...header, endDate: event.target.value })}
            error={Boolean(errors.endDate)}
          />
        </Field>
        <Field label="Responsible">
          <RecordPicker<Contact>
            endpoint="/contacts"
            value={header.responsibleId}
            disabled={!editable}
            onChange={(responsibleId) => setHeader({ ...header, responsibleId })}
            placeholder="Select a contact"
          />
        </Field>
      </div>

      {record?.revisionOf || record?.revisedWith ? (
        <div className="mt-4 flex flex-wrap gap-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
          {record.revisionOf ? (
            <div>
              <span className="font-semibold text-slate-600">Revision Of: </span>
              <Link
                to={`/account/budgets/${record.revisionOf.id}`}
                className="font-bold text-brand-700 hover:underline"
              >
                {record.revisionOf.name}
              </Link>
            </div>
          ) : null}
          {record.revisedWith ? (
            <div>
              <span className="font-semibold text-slate-600">Revised With: </span>
              <Link
                to={`/account/budgets/${record.revisedWith.id}`}
                className="font-bold text-brand-700 hover:underline"
              >
                {record.revisedWith.name}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6">
        {errors.lines ? <p className="error-text mb-2">{errors.lines}</p> : null}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th className="min-w-[220px]">Analytic</th>
                <th>Type</th>
                <th className="w-40 text-right">Committed Amount</th>
                {showAchieved ? (
                  <>
                    <th className="w-40 text-right">Achieved Amount</th>
                    <th className="w-28 text-right">Achieved %</th>
                    <th className="w-40 text-right">Amount To Achieve</th>
                  </>
                ) : null}
                {editable ? <th className="w-12" /> : null}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    <RecordPicker<AnalyticAccount>
                      endpoint="/analytics"
                      value={line.analyticId}
                      disabled={!editable}
                      onChange={(analyticId, analytic) =>
                        update(line.key, {
                          analyticId,
                          analyticType: analytic?.type ?? null,
                          analyticName: analytic?.name ?? '',
                        })
                      }
                      placeholder="Analytic account"
                    />
                  </td>
                  <td>{line.analyticType ? titleCase(line.analyticType) : '-'}</td>
                  <td>
                    <TextInput
                      type="number"
                      min={0}
                      step="0.01"
                      className="text-right"
                      value={line.committedAmount}
                      disabled={!editable}
                      onChange={(event) =>
                        update(line.key, { committedAmount: Number(event.target.value) })
                      }
                    />
                  </td>
                  {showAchieved ? (
                    <>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => void openAchieved(line)}
                          className="font-semibold text-brand-700 hover:underline"
                          title="Show the documents behind this figure"
                        >
                          {formatMoney(line.achievedAmount)}
                        </button>
                      </td>
                      <td className="text-right">{formatPercent(line.achievedPercent)}</td>
                      <td className="text-right">{formatMoney(line.amountToAchieve)}</td>
                    </>
                  ) : null}
                  {editable ? (
                    <td>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-rose-600"
                        aria-label="Remove line"
                        onClick={() =>
                          setLines((current) =>
                            current.length > 1
                              ? current.filter((item) => item.key !== line.key)
                              : current,
                          )
                        }
                      >
                        &times;
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            {record ? (
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td colSpan={2} className="px-3 py-2.5 text-right text-slate-600">
                    Totals
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatMoney(record.totalCommitted)}</td>
                  {showAchieved ? (
                    <>
                      <td className="px-3 py-2.5 text-right">{formatMoney(record.totalAchieved)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {formatPercent(record.achievedPercent)}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatMoney(record.totalToAchieve)}</td>
                    </>
                  ) : null}
                  {editable ? <td /> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {editable ? (
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            Add a line
          </button>
        ) : null}
      </div>

      {drilldown ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Achieved documents</h2>
                <p className="mt-0.5 text-sm text-slate-500">{drilldown.title}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setDrilldown(null)}>
                Close
              </button>
            </div>
            <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
              {drilldown.documents.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  No confirmed documents in this period yet.
                </p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Number</th>
                      <th>Partner</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.documents.map((document) => (
                      <tr
                        key={`${document.kind}-${document.id}`}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate(
                            document.kind === 'INVOICE'
                              ? `/sales/invoices/${document.id}`
                              : `/purchase/bills/${document.id}`,
                          )
                        }
                      >
                        <td>{formatDate(document.date)}</td>
                        <td className="font-semibold text-slate-900">{document.number}</td>
                        <td>{document.partner}</td>
                        <td>
                          <StatusBadge status={document.status} />
                        </td>
                        <td className="text-right font-semibold">{formatMoney(document.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel budget"
        message="The budget moves to the Cancelled stage and is archived out of the pickers."
        confirmLabel="Cancel budget"
        onConfirm={() => {
          setConfirmCancel(false);
          void action('cancel', 'Budget cancelled');
        }}
        onCancel={() => setConfirmCancel(false)}
      />
    </FormShell>
  );
}
