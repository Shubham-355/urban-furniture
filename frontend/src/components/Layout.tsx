import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { titleCase } from '../lib/format';
import { Avatar, Logo } from './ui';

interface MenuItem {
  label: string;
  to: string;
  /** Route the global New button opens while this section is active. */
  newTo?: string;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const MENUS: Menu[] = [
  {
    label: 'Sales',
    items: [
      { label: 'Sales Order', to: '/sales/orders', newTo: '/sales/orders/new' },
      { label: 'Sale Invoice', to: '/sales/invoices', newTo: '/sales/invoices/new' },
      { label: 'Receipt', to: '/sales/receipts', newTo: '/sales/receipts/new' },
    ],
  },
  {
    label: 'Purchase',
    items: [
      { label: 'Purchase Order', to: '/purchase/orders', newTo: '/purchase/orders/new' },
      { label: 'Purchase Bill', to: '/purchase/bills', newTo: '/purchase/bills/new' },
      { label: 'Payment', to: '/purchase/payments', newTo: '/purchase/payments/new' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Contact', to: '/account/contacts', newTo: '/account/contacts/new' },
      { label: 'Product', to: '/account/products', newTo: '/account/products/new' },
      { label: 'Analyticals', to: '/account/analytics', newTo: '/account/analytics/new' },
      { label: 'Analytical Budget', to: '/account/budgets', newTo: '/account/budgets/new' },
      { label: 'Chart of Account', to: '/account/chart-of-accounts', newTo: '/account/chart-of-accounts/new' },
      { label: 'Journals', to: '/account/journals', newTo: '/account/journals/new' },
      { label: 'Journal Entries', to: '/account/journal-entries', newTo: '/account/journal-entries/new' },
    ],
  },
  {
    label: 'Report',
    items: [
      { label: 'Balancesheet', to: '/report/balance-sheet' },
      { label: 'Profit and Loss', to: '/report/profit-and-loss' },
      { label: 'Budget Report', to: '/report/budget' },
    ],
  },
];

/** The New route for whichever module the user is currently looking at. */
function contextualNewRoute(pathname: string): string | null {
  const all = MENUS.flatMap((menu) => menu.items);
  const match = all
    .filter((item) => item.newTo && pathname.startsWith(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.newTo ?? null;
}

export function Layout() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (bar.current && !bar.current.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const newRoute = contextualNewRoute(location.pathname);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-2.5">
          <Link to="/dashboard" className="shrink-0">
            <Logo />
          </Link>

          <nav className="relative hidden flex-1 items-center gap-1 lg:flex" ref={bar}>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Dashboard
            </NavLink>

            {MENUS.map((menu) => {
              const active = menu.items.some((item) => location.pathname.startsWith(item.to));
              return (
                <div key={menu.label} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu((current) => (current === menu.label ? null : menu.label))}
                    className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {menu.label}
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
                    </svg>
                  </button>
                  {openMenu === menu.label ? (
                    <div className="absolute left-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                      {menu.items.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {isAdmin ? (
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-semibold transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                Users
              </NavLink>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {newRoute ? (
              <button type="button" className="btn-primary" onClick={() => navigate(newRoute)}>
                New
              </button>
            ) : null}

            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 sm:flex">
              <Avatar name={user?.name ?? '?'} size={28} />
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-800">{user?.name}</div>
                <div className="text-[11px] text-slate-500">{titleCase(user?.role ?? '')}</div>
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                void signOut().then(() => navigate('/login'));
              }}
            >
              Sign Out
            </button>

            <button
              type="button"
              className="btn-secondary lg:hidden"
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((current) => !current)}
            >
              Menu
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
            <Link to="/dashboard" className="block py-1.5 text-sm font-semibold text-slate-700">
              Dashboard
            </Link>
            {MENUS.map((menu) => (
              <div key={menu.label} className="mt-2">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {menu.label}
                </div>
                {menu.items.map((item) => (
                  <Link key={item.to} to={item.to} className="block py-1.5 text-sm text-slate-700">
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
            {isAdmin ? (
              <Link to="/users" className="mt-2 block py-1.5 text-sm font-semibold text-slate-700">
                Users
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
