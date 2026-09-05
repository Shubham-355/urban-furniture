import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { Payment, PaymentKind } from '../../lib/types';
import { formatDate, formatMoney } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { EmptyState, Spinner, StatusBadge } from '../../components/ui';
import { PaymentEditor } from '../../components/PaymentEditor';
import { FormShell } from '../../components/shells';

/**
 * Purchase > Payment and Sales > Receipt are the same list, filtered by the
 * direction of the money.
 */
export function PaymentsPage({ kind }: { kind: PaymentKind }) {
  const navigate = useNavigate();
  const list = useList<Payment>('/payments', { pageSize: 20, status: kind });
  const isReceipt = kind === 'RECEIVE';
  const base = isReceipt ? '/sales/receipts' : '/purchase/payments';

  return (
    <ListShell
      title={isReceipt ? 'Receipt' : 'Payment'}
      subtitle={
        isReceipt
          ? 'Money received from customers: Debit Bank or Cash, Credit Debtors.'
          : 'Money paid to vendors: Debit Creditors, Credit Bank or Cash.'
      }
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search payment number, partner or note"
      onNew={() => navigate(`${base}/new`)}
      page={list.params.page}
      pageCount={list.pageCount}
      total={list.total}
      onPage={list.setPage}
    >
      {list.loading ? (
        <Spinner />
      ) : list.items.length === 0 ? (
        <EmptyState
          title={isReceipt ? 'No receipts yet' : 'No payments yet'}
          hint="Use New, or the Pay button on a confirmed document."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Date</th>
                <th>Partner</th>
                <th>Document</th>
                <th>Via</th>
                <th className="text-right">Amount</th>
                <th>Journal Entry</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((payment) => (
                <tr key={payment.id}>
                  <td className="font-semibold text-slate-900">{payment.number}</td>
                  <td>{formatDate(payment.date)}</td>
                  <td>{payment.partner.name}</td>
                  <td>
                    {payment.bill ? (
                      <button
                        type="button"
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={() => navigate(`/purchase/bills/${payment.bill!.id}`)}
                      >
                        {payment.bill.number}
                      </button>
                    ) : payment.invoice ? (
                      <button
                        type="button"
                        className="font-semibold text-brand-700 hover:underline"
                        onClick={() => navigate(`/sales/invoices/${payment.invoice!.id}`)}
                      >
                        {payment.invoice.number}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <StatusBadge status={payment.via === 'BANK' ? 'Bank' : 'Cash'} />
                  </td>
                  <td className="text-right font-semibold">{formatMoney(payment.amount)}</td>
                  <td>
                    {payment.journalEntry ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand-700 hover:underline"
                        onClick={() =>
                          navigate(`/account/journal-entries/${payment.journalEntry!.id}`)
                        }
                      >
                        {payment.journalEntry.number}
                      </button>
                    ) : (
                      '-'
                    )}
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

export function PaymentFormPage({ kind }: { kind: PaymentKind }) {
  const navigate = useNavigate();
  const isReceipt = kind === 'RECEIVE';
  const base = isReceipt ? '/sales/receipts' : '/purchase/payments';

  return (
    <FormShell
      title={isReceipt ? 'New Receipt' : 'New Payment'}
      subtitle={
        isReceipt
          ? 'Record money received from a customer.'
          : 'Record money paid to a vendor.'
      }
      backTo={base}
    >
      <div className="max-w-3xl">
        <PaymentEditor
          defaults={{ type: kind, partnerId: null, amount: 0 }}
          onDone={() => navigate(base)}
          onCancel={() => navigate(base)}
        />
      </div>
    </FormShell>
  );
}
