import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { VendorBill } from '../../lib/types';
import { formatDate, formatMoney } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function VendorBillsPage() {
  const navigate = useNavigate();
  const list = useList<VendorBill>('/vendor-bills', { pageSize: 20 });

  return (
    <ListShell
      title="Purchase Bill"
      subtitle="Confirming a bill posts Debit Purchase Expense and Credit Creditors."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search bill number, reference or vendor"
      onNew={() => navigate('/purchase/bills/new')}
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
        <EmptyState title="No vendor bills yet" hint="Create one here or from a confirmed purchase order." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Vendor Bill No.</th>
                <th>Vendor Name</th>
                <th>Bill Reference</th>
                <th>Bill Date</th>
                <th>Due Date</th>
                <th className="text-right">Total</th>
                <th className="text-right">Amount Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((bill) => (
                <tr
                  key={bill.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/purchase/bills/${bill.id}`)}
                >
                  <td className="font-semibold text-slate-900">{bill.number}</td>
                  <td>{bill.vendor.name}</td>
                  <td>{bill.reference ?? '-'}</td>
                  <td>{formatDate(bill.billDate)}</td>
                  <td>{formatDate(bill.dueDate)}</td>
                  <td className="text-right">{formatMoney(bill.total)}</td>
                  <td className="text-right font-semibold">{formatMoney(bill.amountDue)}</td>
                  <td>
                    <StatusBadge status={bill.status} />
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
