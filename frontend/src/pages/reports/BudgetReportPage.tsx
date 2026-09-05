import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api, downloadFile, errorMessage, printPdf } from '../../lib/api';
import type { AnalyticAccount, BudgetReportRow } from '../../lib/types';
import { formatDate, formatMoney, formatPercent } from '../../lib/format';
import { useToast } from '../../app/ToastContext';
import { EmptyState, Spinner, StatusBadge, ViewToggle } from '../../components/ui';

const ACHIEVED_COLOR = '#7c3aed';
const BALANCE_COLOR = '#e2e8f0';

/** Achieved versus the amount still to achieve for one budget. */
function BudgetPie({ row, size = 120 }: { row: BudgetReportRow; size?: number }) {
  const balance = Math.max(row.balance, 0);
  const data = [
    { name: 'Achieved', value: row.achieved },
    { name: 'Balance', value: balance },
  ];

  if (row.achieved === 0 && balance === 0) {
    return (
      <div
        style={{ height: size }}
        className="grid place-items-center text-xs text-slate-400"
      >
        Nothing committed
      </div>
    );
  }

  return (
    <div style={{ height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="45%"
            outerRadius="80%"
            paddingAngle={1}
            isAnimationActive={false}
          >
            <Cell fill={ACHIEVED_COLOR} />
            <Cell fill={BALANCE_COLOR} />
          </Pie>
          <Tooltip formatter={(value) => formatMoney(Number(value ?? 0))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BudgetReportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<BudgetReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);

  useEffect(() => {
    api
      .get<{ items: BudgetReportRow[] }>('/reports/budget')
      .then(({ data }) => setRows(data.items))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the budget report')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const print = async () => {
    setBusy('print');
    try {
      await printPdf('/reports/budget/pdf');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open the print dialog'));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy('download');
    try {
      await downloadFile('/reports/budget/pdf', 'budget-report.pdf');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download the PDF'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budget Report</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Achieved versus balance for every budget. Click a row to open the budget.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => void print()}
          >
            {busy === 'print' ? 'Preparing...' : 'Print'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => void download()}
          >
            {busy === 'download' ? 'Preparing...' : 'Download'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {loading ? (
        <Spinner label="Building the report..." />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState title="No budgets yet" hint="Create a budget to see it reported here." />
        </div>
      ) : view === 'list' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th className="text-right">Committed</th>
                  <th className="text-right">Achieved</th>
                  <th className="text-right">Achieved %</th>
                  <th className="w-40 text-center">Pie Chart</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/account/budgets/${row.id}`)}
                  >
                    <td className="font-semibold text-slate-900">{row.name}</td>
                    <td>{formatDate(row.startDate)}</td>
                    <td>{formatDate(row.endDate)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right">{formatMoney(row.committed)}</td>
                    <td className="text-right font-semibold">{formatMoney(row.achieved)}</td>
                    <td className="text-right">{formatPercent(row.achievedPercent)}</td>
                    <td>
                      <BudgetPie row={row} size={90} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => navigate(`/account/budgets/${row.id}`)}
              className="card p-4 text-left transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{row.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatDate(row.startDate)} - {formatDate(row.endDate)}
                  </div>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <BudgetPie row={row} size={150} />
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Committed</dt>
                  <dd className="font-semibold">{formatMoney(row.committed)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Achieved</dt>
                  <dd className="font-semibold text-brand-700">{formatMoney(row.achieved)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Balance</dt>
                  <dd className="font-semibold">{formatMoney(row.balance)}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Target of the Budget smart button on a bill or an invoice. */
export function BudgetAnalyticReportPage() {
  const { analyticId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<{ analytic: AnalyticAccount; items: BudgetReportRow[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ analytic: AnalyticAccount; items: BudgetReportRow[] }>(
        `/reports/budget-analytic/${analyticId}`,
      )
      .then((response) => setData(response.data))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the analytic report')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyticId]);

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Budget Analytic Report - {data.analytic.name}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Every budget that measures this analytic account.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(`/account/analytics/${data.analytic.id}`)}
          >
            Open analytic
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {data.items.length === 0 ? (
          <EmptyState
            title="Not budgeted yet"
            hint="This analytic account is not used on any budget."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th className="text-right">Committed</th>
                  <th className="text-right">Achieved</th>
                  <th className="text-right">Achieved %</th>
                  <th className="text-right">Amount To Achieve</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/account/budgets/${row.id}`)}
                  >
                    <td className="font-semibold text-slate-900">{row.name}</td>
                    <td>{formatDate(row.startDate)}</td>
                    <td>{formatDate(row.endDate)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="text-right">{formatMoney(row.committed)}</td>
                    <td className="text-right font-semibold">{formatMoney(row.achieved)}</td>
                    <td className="text-right">{formatPercent(row.achievedPercent)}</td>
                    <td className="text-right">{formatMoney(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
