import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { CustomerInvoice } from '../../lib/types';
import { formatDate, formatMoney } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function CustomerInvoicesPage() {
  const navigate = useNavigate();
  const list = useList<CustomerInvoice>('/customer-invoices', { pageSize: 20 });

  return (
    <ListShell
      title="Sale Invoice"
      subtitle="Confirming an invoice posts Debit Debtors and Credit Sales Income."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search invoice number, reference or customer"
      onNew={() => navigate('/sales/invoices/new')}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
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
        <EmptyState
          title="No invoices yet"
          hint="Create one here or from a confirmed sales order."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Customer Invoice No.</th>
                <th>Customer Name</th>
                <th>Invoice Reference</th>
                <th>Invoice Date</th>
                <th>Due Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Amount Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/sales/invoices/${invoice.id}`)}
                >
                  <td className="font-semibold text-slate-900">{invoice.number}</td>
                  <td>{invoice.customer.name}</td>
                  <td>{invoice.reference ?? '-'}</td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td className="text-right">{formatMoney(invoice.total)}</td>
                  <td className="text-right font-semibold">{formatMoney(invoice.amountDue)}</td>
                  <td>
                    <StatusBadge status={invoice.status} />
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
