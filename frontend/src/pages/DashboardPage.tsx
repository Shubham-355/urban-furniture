import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, errorMessage } from '../lib/api';
import type { DashboardDocumentRow, DashboardSummary } from '../lib/types';
import { formatCompactINR, formatDate, formatMoney, formatPercent } from '../lib/format';
import { useToast } from '../app/ToastContext';
import { Spinner } from '../components/ui';

/**
 * Two categorical series, validated against the white card surface:
 * blue / orange clear the CVD, normal-vision and contrast gates.
 */
const INCOME_COLOR = '#2a78d6';
const EXPENSE_COLOR = '#eb6834';
const GRID = '#eceef2';
const AXIS_TEXT = '#64748b';

// ------------------------------------------------------------------ stat tiles

function StatTile({
  label,
  value,
  hint,
  tone = 'plain',
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'plain' | 'hero';
  accent?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        {accent ? (
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
        ) : null}
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <div
        className={`mt-1.5 font-black tabular-nums text-slate-900 ${
          tone === 'hero' ? 'text-3xl' : 'text-2xl'
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

// --------------------------------------------------------------- module counts

interface Metric {
  label: string;
  value: number;
  to: string;
}

function ModuleCard({ title, hint, metrics }: { title: string; hint: string; metrics: Metric[] }) {
  const navigate = useNavigate();
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={() => navigate(metric.to)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50"
          >
            <div className="text-xl font-black tabular-nums text-slate-900">{metric.value}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">{metric.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- meters

/** A single ratio against its limit: same-hue track, no second colour. */
function BudgetMeter({
  name,
  committed,
  achieved,
  percent,
  onClick,
}: {
  name: string;
  committed: number;
  achieved: number;
  percent: number;
  onClick: () => void;
}) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">
          {formatPercent(percent)}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-brand-600"
          style={{ width: `${width}%` }}
          role="presentation"
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{formatMoney(achieved)} achieved</span>
        <span>of {formatMoney(committed)}</span>
      </div>
    </button>
  );
}

// ------------------------------------------------------------------ due lists

function DueList({
  title,
  emptyLabel,
  rows,
  overdueCount,
  total,
  accent,
}: {
  title: string;
  emptyLabel: string;
  rows: DashboardDocumentRow[];
  overdueCount: number;
  total: number;
  accent: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h2>
        </div>
        <span className="text-sm font-bold tabular-nums text-slate-900">{formatMoney(total)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    row.kind === 'INVOICE'
                      ? `/sales/invoices/${row.id}`
                      : `/purchase/bills/${row.id}`,
                  )
                }
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {row.number}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {row.partner}
                    {row.dueDate ? ` - due ${formatDate(row.dueDate)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-slate-900">
                    {formatMoney(row.amountDue)}
                  </span>
                  {row.overdue ? (
                    <span className="text-xs font-semibold text-rose-600">Overdue</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {overdueCount > 0 ? (
        <div className="mt-auto border-t border-slate-100 px-4 py-2 text-xs font-semibold text-rose-600">
          {overdueCount} past its due date
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------- page

export function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardSummary>('/dashboard/summary')
      .then(({ data }) => setSummary(data))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the dashboard')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (!summary) return null;

  const { financials, period } = summary;
  const chartData = summary.monthly.map((month) => ({
    label: month.label,
    Income: month.income,
    Expense: month.expense,
  }));
  const hasChartData = chartData.some((row) => row.Income !== 0 || row.Expense !== 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Financial year {formatDate(period.from)} to {formatDate(period.to)} - every figure comes
            from posted journal entries.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/report/profit-and-loss')}
          >
            Profit and Loss
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/report/balance-sheet')}
          >
            Balancesheet
          </button>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Net Income"
          value={formatMoney(financials.netIncome)}
          hint="Income less expenses this year"
          tone="hero"
        />
        <StatTile
          label="Income"
          value={formatMoney(financials.income)}
          hint="Credited to income accounts"
          accent={INCOME_COLOR}
        />
        <StatTile
          label="Expenses"
          value={formatMoney(financials.expenses)}
          hint="Purchase and other expenses"
          accent={EXPENSE_COLOR}
        />
        <StatTile
          label="Cash and Bank"
          value={formatMoney(financials.liquidity)}
          hint={`Bank ${formatMoney(financials.bank)} - Cash ${formatMoney(financials.cash)}`}
        />
      </div>

      {/* Trend + budgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Income and expense by month
            </h2>
            <span className="text-xs text-slate-400">Financial year to date</span>
          </div>

          {hasChartData ? (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                    tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                    tickFormatter={(value) => formatCompactINR(Number(value))}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                    formatter={(value) => formatMoney(Number(value ?? 0))}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={28}
                    iconType="circle"
                    iconSize={9}
                    wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }}
                  />
                  <Bar dataKey="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="Expense" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-[260px] place-items-center text-sm text-slate-500">
              Nothing posted in this financial year yet.
            </div>
          )}
        </div>

        <div className="card flex flex-col p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Budget progress
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:underline"
              onClick={() => navigate('/report/budget')}
            >
              Budget Report
            </button>
          </div>

          {summary.budgetProgress.length === 0 ? (
            <p className="grid flex-1 place-items-center text-sm text-slate-500">
              No confirmed budgets yet.
            </p>
          ) : (
            <div className="space-y-4">
              {summary.budgetProgress.map((budget) => (
                <BudgetMeter
                  key={budget.id}
                  name={budget.name}
                  committed={budget.committed}
                  achieved={budget.achieved}
                  percent={budget.percent}
                  onClick={() => navigate(`/account/budgets/${budget.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module counts - every number opens its filtered list */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ModuleCard
          title="Purchase"
          hint="Purchase Orders"
          metrics={[
            { label: 'All', value: summary.purchase.all, to: '/purchase/orders' },
            {
              label: 'Confirmed',
              value: summary.purchase.confirmed,
              to: '/purchase/orders?status=CONFIRMED',
            },
            { label: 'Draft', value: summary.purchase.draft, to: '/purchase/orders?status=DRAFT' },
          ]}
        />
        <ModuleCard
          title="Sales"
          hint="Sales Orders"
          metrics={[
            { label: 'All', value: summary.sales.all, to: '/sales/orders' },
            {
              label: 'Confirmed',
              value: summary.sales.confirmed,
              to: '/sales/orders?status=CONFIRMED',
            },
            { label: 'Draft', value: summary.sales.draft, to: '/sales/orders?status=DRAFT' },
          ]}
        />
        <ModuleCard
          title="Budget Reports"
          hint="Analytical budgets"
          metrics={[
            { label: 'Achieved', value: summary.budgets.achieved, to: '/report/budget' },
            { label: 'Budget', value: summary.budgets.budget, to: '/report/budget' },
            { label: 'Committed', value: summary.budgets.committed, to: '/report/budget' },
          ]}
        />
      </div>

      {/* What is still owed, and what last hit the ledger */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DueList
          title="To collect"
          emptyLabel="Every confirmed invoice is settled."
          rows={summary.receivables.rows}
          overdueCount={summary.receivables.overdueCount}
          total={financials.receivable}
          accent={INCOME_COLOR}
        />
        <DueList
          title="To pay"
          emptyLabel="Every confirmed bill is settled."
          rows={summary.payables.rows}
          overdueCount={summary.payables.overdueCount}
          total={financials.payable}
          accent={EXPENSE_COLOR}
        />

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Recent entries
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:underline"
              onClick={() => navigate('/account/journal-entries')}
            >
              View all
            </button>
          </div>

          {summary.recentEntries.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Nothing posted yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.recentEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/account/journal-entries/${entry.id}`)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-brand-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {entry.number}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {entry.journal}
                        {entry.partner ? ` - ${entry.partner}` : ''} - {formatDate(entry.date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                      {formatMoney(entry.total)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
