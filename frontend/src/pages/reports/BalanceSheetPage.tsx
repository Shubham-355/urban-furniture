import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import type { BalanceSheet } from '../../lib/types';
import { formatMoney } from '../../lib/format';
import { useToast } from '../../app/ToastContext';
import { Spinner, WarningBanner } from '../../components/ui';
import { financialYear, ReportShell, type Period } from './ReportShell';

export function BalanceSheetPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(financialYear());
  const [report, setReport] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<BalanceSheet>('/reports/balance-sheet', { params: { asOf: period.to } })
      .then(({ data }) => setReport(data))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the report')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.to]);

  return (
    <ReportShell
      title="Balancesheet"
      subtitle="Cumulative up to the end of the period, so assets always equal liabilities plus capital."
      period={period}
      onPeriodChange={setPeriod}
      pdfUrl={`/reports/balance-sheet/pdf?asOf=${period.to}`}
      pdfName="balance-sheet.pdf"
    >
      {loading || !report ? (
        <Spinner label="Building the report..." />
      ) : (
        <>
          {!report.balanced ? (
            <WarningBanner>
              This balance sheet does not balance. Total Assets {formatMoney(report.totalAssets)}{' '}
              differs from Total Liability and Capital{' '}
              {formatMoney(report.totalLiabilitiesAndCapital)} by {formatMoney(report.difference)}.
            </WarningBanner>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-600">
                Assets
              </div>
              <table className="table">
                <tbody>
                  {report.assets.accounts.length === 0 ? (
                    <tr>
                      <td className="text-slate-400">No asset postings</td>
                      <td className="text-right text-slate-400">{formatMoney(0)}</td>
                    </tr>
                  ) : (
                    report.assets.accounts.map((account) => (
                      <tr key={account.accountId}>
                        <td>{account.accountName}</td>
                        <td className="w-44 text-right font-semibold">
                          {formatMoney(account.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-50 font-bold">
                    <td>Total Asset</td>
                    <td className="text-right">{formatMoney(report.assets.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-600">
                Liabilities and Capital
              </div>
              <table className="table">
                <tbody>
                  {report.liabilities.accounts.map((account) => (
                    <tr key={account.accountId}>
                      <td>{account.accountName}</td>
                      <td className="w-44 text-right font-semibold">
                        {formatMoney(account.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <td colSpan={2}>Capital</td>
                  </tr>
                  {report.capital.accounts.map((account) => (
                    <tr key={account.accountId}>
                      <td>{account.accountName}</td>
                      <td className="text-right font-semibold">{formatMoney(account.balance)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>Net Income</td>
                    <td className="text-right font-semibold">
                      {formatMoney(report.capital.netIncome)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold">
                    <td>Total Liability and Capital</td>
                    <td className="text-right">
                      {formatMoney(report.totalLiabilitiesAndCapital)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="text-sm font-semibold text-slate-600">
              Total Assets {formatMoney(report.totalAssets)} = Total Liability and Capital{' '}
              {formatMoney(report.totalLiabilitiesAndCapital)}
            </div>
            <span
              className={`badge ${
                report.balanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {report.balanced ? 'Balanced' : 'Out of balance'}
            </span>
          </div>
        </>
      )}
    </ReportShell>
  );
}
