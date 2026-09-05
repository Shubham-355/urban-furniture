import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import type { DashboardSummary } from '../lib/types';
import { useToast } from '../app/ToastContext';
import { PageTitle, Spinner } from '../components/ui';

interface Metric {
  label: string;
  value: number;
  to: string;
}

/** One KPI card; every count opens the matching filtered list. */
function KpiCard({ title, hint, metrics }: { title: string; hint: string; metrics: Metric[] }) {
  const navigate = useNavigate();
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={() => navigate(metric.to)}
            className="rounded-lg border border-slate-200 px-3 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50"
          >
            <div className="text-2xl font-black text-slate-900">{metric.value}</div>
            <div className="mt-0.5 text-xs font-semibold text-slate-500">{metric.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
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

  return (
    <div>
      <PageTitle
        title="Dashboard"
        subtitle="Live counts across purchases, sales and budgets. Click any number to open that list."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <KpiCard
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

        <KpiCard
          title="Sales"
          hint="Sales Orders"
          metrics={[
            { label: 'All', value: summary.sales.all, to: '/sales/orders' },
            { label: 'Confirmed', value: summary.sales.confirmed, to: '/sales/orders?status=CONFIRMED' },
            { label: 'Draft', value: summary.sales.draft, to: '/sales/orders?status=DRAFT' },
          ]}
        />

        <KpiCard
          title="Budget Reports"
          hint="Analytical budgets"
          metrics={[
            { label: 'Achieved', value: summary.budgets.achieved, to: '/report/budget' },
            { label: 'Budget', value: summary.budgets.budget, to: '/report/budget' },
            { label: 'Committed', value: summary.budgets.committed, to: '/report/budget' },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            How a purchase flows
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Purchase Order - no accounting entry yet.</li>
            <li>2. Create Bill from the confirmed order.</li>
            <li>3. Confirm the bill: Debit Purchase Expense, Credit Creditors.</li>
            <li>4. Pay the bill: Debit Creditors, Credit Bank or Cash.</li>
          </ol>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            How a sale flows
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-600">
            <li>1. Sales Order - no accounting entry yet.</li>
            <li>2. Create Invoice from the confirmed order.</li>
            <li>3. Confirm the invoice: Debit Debtors, Credit Sales Income.</li>
            <li>4. Receive payment: Debit Bank or Cash, Credit Debtors.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
