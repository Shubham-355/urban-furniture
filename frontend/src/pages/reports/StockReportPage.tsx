import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import type { StockReport } from '../../lib/types';
import { formatMoney, titleCase } from '../../lib/format';
import { useToast } from '../../app/ToastContext';
import { Spinner } from '../../components/ui';
import { financialYear, ReportShell, type Period } from './ReportShell';

/** Quantities are Decimal(14,2): show the decimals only when there are any. */
function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

export function StockReportPage() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(financialYear());
  const [report, setReport] = useState<StockReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<StockReport>('/reports/stock', { params: period })
      .then(({ data }) => setReport(data))
      .catch((error) => toast.error(errorMessage(error, 'Could not load the report')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.from, period.to]);

  const short = negatives(report);

  return (
    <ReportShell
      title="Stock Report"
      subtitle="Quantities on hand, derived from confirmed bills and invoices."
      period={period}
      onPeriodChange={setPeriod}
      pdfUrl={`/reports/stock/pdf?from=${period.from}&to=${period.to}`}
      pdfName="stock-report.pdf"
    >
      {loading || !report ? (
        <Spinner label="Building the report..." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Closing Stock Value"
              value={formatMoney(report.totals.stockValue)}
              hint="Units on hand at purchase cost"
            />
            <Tile
              label="Units On Hand"
              value={formatQty(report.totals.closingQty)}
              hint={`${report.rows.length} product(s) tracked`}
            />
            <Tile
              label="Purchased"
              value={formatMoney(report.totals.inValue)}
              hint={`${formatQty(report.totals.inQty)} unit(s) received`}
            />
            <Tile
              label="Sold"
              value={formatMoney(report.totals.outValue)}
              hint={`${formatQty(report.totals.outQty)} unit(s) delivered`}
            />
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th className="text-right">Opening</th>
                    <th className="text-right">In</th>
                    <th className="text-right">Out</th>
                    <th className="text-right">Closing</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400">
                        No stocked products yet. Goods and combos appear here; services carry no
                        stock.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr key={row.productId}>
                        <td className="font-semibold text-slate-800">{row.productName}</td>
                        <td className="text-slate-500">{titleCase(row.productType)}</td>
                        <td className="text-slate-500">{row.categoryName ?? '-'}</td>
                        <td className="text-right">{formatQty(row.openingQty)}</td>
                        <td className="text-right text-emerald-700">
                          {row.inQty === 0 ? '-' : `+${formatQty(row.inQty)}`}
                        </td>
                        <td className="text-right text-rose-700">
                          {row.outQty === 0 ? '-' : `-${formatQty(row.outQty)}`}
                        </td>
                        <td
                          className={`text-right font-bold ${
                            row.closingQty < 0 ? 'text-rose-700' : 'text-slate-800'
                          }`}
                        >
                          {formatQty(row.closingQty)}
                        </td>
                        <td className="text-right text-slate-500">{formatMoney(row.unitCost)}</td>
                        <td
                          className={`text-right font-semibold ${
                            row.stockValue < 0 ? 'text-rose-700' : ''
                          }`}
                        >
                          {formatMoney(row.stockValue)}
                        </td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3}>Total</td>
                    <td className="text-right">{formatQty(report.totals.openingQty)}</td>
                    <td className="text-right">{formatQty(report.totals.inQty)}</td>
                    <td className="text-right">{formatQty(report.totals.outQty)}</td>
                    <td className="text-right">{formatQty(report.totals.closingQty)}</td>
                    <td />
                    <td className="text-right">{formatMoney(report.totals.stockValue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {short.length > 0 ? (
            <div className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <span className="font-bold">
                {short.length} product{short.length > 1 ? 's are' : ' is'} showing negative stock:
              </span>{' '}
              {short.join(', ')}. More has been invoiced than was ever billed in, so either the
              purchase side is missing a vendor bill or the goods were opening stock that was never
              recorded.
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Opening + In - Out = Closing, per product. Quantities come from vendor bills and
            customer invoices from Confirmed onwards; drafts and cancelled documents are ignored.
            Services carry no stock and are left out.
          </p>
        </div>
      )}
    </ReportShell>
  );
}

function negatives(report: StockReport | null): string[] {
  return (report?.rows ?? []).filter((row) => row.closingQty < 0).map((row) => row.productName);
}
