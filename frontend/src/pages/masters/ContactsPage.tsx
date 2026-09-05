import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useList } from '../../hooks/useList';
import type { Contact } from '../../lib/types';
import { titleCase } from '../../lib/format';
import { ListShell } from '../../components/shells';
import { Avatar, EmptyState, Spinner, StatusBadge } from '../../components/ui';

export function ContactsPage() {
  const navigate = useNavigate();
  const list = useList<Contact>('/contacts', { pageSize: 20 });
  // Cards read better than rows for contacts, so kanban is the default.
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  return (
    <ListShell
      title="Contact"
      subtitle="Customers and vendors used across every document."
      search={list.params.search ?? ''}
      onSearch={list.setSearch}
      searchPlaceholder="Search name, email, phone or city"
      onNew={() => navigate('/account/contacts/new')}
      archived={list.params.archived}
      onArchived={list.setArchived}
      view={view}
      onView={setView}
      filters={
        <select
          className="input w-auto py-2"
          value={list.params.status ?? ''}
          onChange={(event) => list.setStatus(event.target.value || undefined)}
          aria-label="Type filter"
        >
          <option value="">All types</option>
          <option value="CUSTOMER">Customer</option>
          <option value="VENDOR">Vendor</option>
          <option value="BOTH">Both</option>
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
        <EmptyState title="No contacts yet" hint="Use New to add your first customer or vendor." />
      ) : view === 'list' ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-10" />
                <th className="w-16">Image</th>
                <th>
                  <button type="button" onClick={() => list.setSort('name')}>
                    Name
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => list.setSort('email')}>
                    Email
                  </button>
                </th>
                <th>Phone</th>
                <th>Type</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((contact) => (
                <tr
                  key={contact.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/account/contacts/${contact.id}`)}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${contact.name}`}
                      checked={selected.includes(contact.id)}
                      onChange={() => toggle(contact.id)}
                    />
                  </td>
                  <td>
                    <Avatar name={contact.name} url={contact.imageUrl} size={34} />
                  </td>
                  <td className="font-semibold text-slate-900">
                    {contact.name}
                    {contact.isArchived ? (
                      <span className="ml-2 text-xs font-medium text-rose-600">Archived</span>
                    ) : null}
                  </td>
                  <td>{contact.email}</td>
                  <td>{contact.mobile ?? '-'}</td>
                  <td>
                    <StatusBadge status={titleCase(contact.type)} />
                  </td>
                  <td className="text-xs text-slate-500">
                    {contact.portalUser ? contact.portalUser.loginId : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.items.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => navigate(`/account/contacts/${contact.id}`)}
              className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <Avatar name={contact.name} url={contact.imageUrl} size={48} />
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">{contact.name}</div>
                  <div className="truncate text-sm text-slate-500">{contact.email}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>{contact.mobile ?? 'No phone'}</span>
                <StatusBadge status={titleCase(contact.type)} />
              </div>
            </button>
          ))}
        </div>
      )}
    </ListShell>
  );
}
