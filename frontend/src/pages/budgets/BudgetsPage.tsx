import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { Budget } from '../../lib/types';
import { formatDate, formatMoney, formatPercent } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function BudgetsPage() {
  const navigate = useNavigate();
  const list = useList<Budget>('/budgets', { pageSize: 20 });

  return (
    <ListShell
      title="Analytical Budget"
      subtitle="Committed amounts per analytic account, measured against confirmed documents."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search budget name"
      onNew={() => navigate('/account/budgets/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Budget status filter"
        >
          <option value="">All stages</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="REVISED">Revised</option>
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
        <EmptyState title="No budgets yet" hint="Use New to plan your first budget." />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Budget</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Responsible</th>
                <th className="text-right">Committed</th>
                <th className="text-right">Achieved</th>
                <th className="text-right">Achieved %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((budget) => (
                <tr
                  key={budget.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/budgets/${budget.id}`)}
                >
                  <td className="font-semibold text-slate-900">{budget.name}</td>
                  <td>{formatDate(budget.startDate)}</td>
                  <td>{formatDate(budget.endDate)}</td>
                  <td>{budget.responsible?.name ?? '-'}</td>
                  <td className="text-right">{formatMoney(budget.totalCommitted)}</td>
                  <td className="text-right font-semibold">{formatMoney(budget.totalAchieved)}</td>
                  <td className="text-right">{formatPercent(budget.achievedPercent)}</td>
                  <td>
                    <StatusBadge status={budget.status} />
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
