import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { Product } from '../../lib/types';
import { formatMoney, titleCase } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { Avatar, EmptyState, Spinner } from '../../components/ui';

export function ProductsPage() {
  const navigate = useNavigate();
  const list = useList<Product>('/products', { pageSize: 20 });
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  return (
    <ListShell
      title="Product"
      subtitle="Goods and services with their sales price and cost."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search product or category"
      onNew={() => navigate('/account/products/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      view={view}
      onView={setView}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Product type filter"
        >
          <option value="">All types</option>
          <option value="GOODS">Goods</option>
          <option value="SERVICE">Service</option>
          <option value="COMBO">Combo</option>
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
        <EmptyState title="No products yet" hint="Use New to add your first product." />
      ) : view === 'list' ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10" />
                <th className="w-16">Image</th>
                <th>
                  <button type="button" onClick={() => list.setSort('name')}>
                    Product
                  </button>
                </th>
                <th>Category</th>
                <th>Type</th>
                <th className="text-right">
                  <button type="button" onClick={() => list.setSort('salesPrice')}>
                    Sales Price
                  </button>
                </th>
                <th className="text-right">
                  <button type="button" onClick={() => list.setSort('cost')}>
                    Cost
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((product) => (
                <tr
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/products/${product.id}`)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${product.name}`}
                      checked={selected.includes(product.id)}
                      onChange={() => toggle(product.id)}
                    />
                  </td>
                  <td>
                    <Avatar name={product.name} url={product.imageUrl} size={34} />
                  </td>
                  <td className="font-semibold text-slate-900">
                    {product.name}
                    {product.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>{product.category?.name ?? '-'}</td>
                  <td>{titleCase(product.type)}</td>
                  <td className="text-right font-semibold">{formatMoney(product.salesPrice)}</td>
                  <td className="text-right">{formatMoney(product.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.items.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => navigate(`/account/products/${product.id}`)}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Avatar name={product.name} url={product.imageUrl} size={48} />
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">{product.name}</div>
                  <div className="truncate text-sm text-slate-500">
                    {product.category?.name ?? 'Uncategorised'}
                  </div>
                </div>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Sales Price</dt>
                  <dd className="font-semibold text-slate-900">{formatMoney(product.salesPrice)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Cost</dt>
                  <dd className="font-semibold text-slate-900">{formatMoney(product.cost)}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}
    </ListShell>
  );
}
