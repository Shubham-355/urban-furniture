import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { PurchaseOrder } from '../../lib/types';
import { formatDate, formatMoney } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const list = useList<PurchaseOrder>('/purchase-orders', {
    pageSize: 20,
    status: searchParams.get('status') ?? undefined,
  });

  // The dashboard links here with a status already applied.
  useEffect(() => {
    list.setStatus(searchParams.get('status') ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <ListShell
      title="Purchase Order"
      subtitle="Order goods from a vendor. Confirming an order does not post any accounting."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search PO number or vendor"
      onNew={() => navigate('/purchase/orders/new')}
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
          <option value="BILLED">Billed</option>
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
        <EmptyState title="No purchase orders yet" hint="Use New to raise your first order." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>PO No.</th>
                <th>Vendor Name</th>
                <th>PO Date</th>
                <th className="text-right">Total</th>
                <th>Bill</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/purchase/orders/${order.id}`)}
                >
                  <td className="font-semibold text-slate-900">{order.number}</td>
                  <td>{order.vendor.name}</td>
                  <td>{formatDate(order.date)}</td>
                  <td className="text-right font-semibold">{formatMoney(order.total)}</td>
                  <td className="text-xs text-slate-500">
                    {order.bills.map((bill) => bill.number).join(', ') || '-'}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
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
