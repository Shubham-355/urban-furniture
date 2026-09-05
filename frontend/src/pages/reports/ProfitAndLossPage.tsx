import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import type { AccountBalance, ProfitAndLoss } from '../../lib/types';
import { formatMoney } from '../../lib/format';
import { useToast } from '../../app/ToastContext';
import { Spinner } from '../../components/ui';
import { financialYear, ReportShell, type Period } from './ReportShell';

function Section({
  heading,
  accounts,
  totalLabel,
  total,
}: {
  heading: string;
  accounts: AccountBalance[];
  totalLabel: string;
  total: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-600">
        {heading}
      </div>
      <table className="table">
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td className="text-slate-400">No postings in this period</td>
              <td className="text-right text-slate-400">{formatMoney(0)}</td>
            </tr>
          ) : (
            accounts.map((account) => (
              <tr key={account.accountId}>
                <td>{account.accountName}</td>
                <td className="w-44 text-right font-semibold">{formatMoney(account.balance)}</td>
              </tr>
            ))
          )}
          <tr className="bg-slate-50 font-bold">
            <td>{totalLabel}</td>
            <td className="text-right">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ProfitAndLossPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(financialYear());
  const [report, setReport] = useState<ProfitAndLoss | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<ProfitAndLoss>('/reports/profit-loss', { params: period })
      .then(({ data }) => setReport(data))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the report')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.from, period.to]);

  return (
    <ReportShell
      title="Profit and Loss"
      subtitle="Derived from posted journal entries only."
      period={period}
      onPeriodChange={setPeriod}
      pdfUrl={`/reports/profit-loss/pdf?from=${period.from}&to=${period.to}`}
      pdfName="profit-and-loss.pdf"
    >
      {loading || !report ? (
        <Spinner label="Building the report..." />
      ) : (
        <div className="space-y-4">
          <Section
            heading="Income"
            accounts={report.income.accounts}
            totalLabel="Total Income"
            total={report.income.total}
          />
          <Section
            heading="Expenses"
            accounts={[...report.expenses.purchase.accounts, ...report.expenses.other.accounts]}
            totalLabel="Total Expenses"
            total={report.expenses.total}
          />

          <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <div className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Net Income
              </div>
              <p className="mt-0.5 text-sm text-slate-500">Total Income less Total Expenses</p>
            </div>
            <div
              className={`text-3xl font-black ${
                report.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatMoney(report.netIncome)}
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
}
