import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { titleCase } from '../lib/format';
import { Avatar, Logo } from './ui';

interface MenuItem {
  label: string;
  to: string;
}

interface Menu {
  label: string;
  items: MenuItem[];
}

const MENUS: Menu[] = [
  {
    label: 'Sales',
    items: [
      { label: 'Sales Order', to: '/sales/orders' },
      { label: 'Sale Invoice', to: '/sales/invoices' },
      { label: 'Receipt', to: '/sales/receipts' },
    ],
  },
  {
    label: 'Purchase',
    items: [
      { label: 'Purchase Order', to: '/purchase/orders' },
      { label: 'Purchase Bill', to: '/purchase/bills' },
      { label: 'Payment', to: '/purchase/payments' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Contact', to: '/account/contacts' },
      { label: 'Product', to: '/account/products' },
      { label: 'Analyticals', to: '/account/analytics' },
      { label: 'Analytical Budget', to: '/account/budgets' },
      { label: 'Chart of Account', to: '/account/chart-of-accounts' },
      { label: 'Journals', to: '/account/journals' },
      { label: 'Journal Entries', to: '/account/journal-entries' },
    ],
  },
  {
    label: 'Report',
    items: [
      { label: 'Balancesheet', to: '/report/balance-sheet' },
      { label: 'Profit and Loss', to: '/report/profit-and-loss' },
      { label: 'Budget Report', to: '/report/budget' },
      { label: 'Stock Report', to: '/report/stock' },
    ],
  },
];

/** Section trail for the top bar: ['Sales', 'Sale Invoice']. */
function currentSection(pathname: string): string[] {
  if (pathname.startsWith('/dashboard')) return ['Dashboard'];
  if (pathname.startsWith('/users')) return ['Users'];
  for (const menu of MENUS) {
    const item = menu.items
      .filter((entry) => pathname.startsWith(entry.to))
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (item) return [menu.label, item.label];
  }
  return [];
}

/** The group the current route belongs to, if any. */
function currentMenu(pathname: string): string | null {
  return (
    MENUS.find((menu) => menu.items.some((item) => pathname.startsWith(item.to)))?.label ?? null
  );
}

const ICONS: Record<string, ReactNode> = {
  Dashboard: (
    <>
      <rect x="3" y="3" width="5.5" height="5.5" rx="1.4" />
      <rect x="11.5" y="3" width="5.5" height="3.5" rx="1.4" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.4" />
      <rect x="11.5" y="9.5" width="5.5" height="7.5" rx="1.4" />
    </>
  ),
  Sales: (
    <>
      <path d="M2.6 3.4h1.9l1.8 8.1h7.4l1.6-5.8H5.1" />
      <circle cx="7.6" cy="15.4" r="1.1" />
      <circle cx="13.3" cy="15.4" r="1.1" />
    </>
  ),
  Purchase: (
    <>
      <path d="M10 2.8 17 6.4v7.2L10 17.2 3 13.6V6.4L10 2.8Z" />
      <path d="M3 6.4 10 10l7-3.6M10 10v7.2" />
    </>
  ),
  Account: (
    <>
      <path d="M5.2 2.8h9a.9.9 0 0 1 .9.9v12.6a.9.9 0 0 1-.9.9h-9a.9.9 0 0 1-.9-.9V3.7a.9.9 0 0 1 .9-.9Z" />
      <path d="M7.2 6.6h5M7.2 9.8h5M7.2 13h2.8" />
    </>
  ),
  Report: (
    <>
      <path d="M3.2 16.6h13.6" />
      <path d="M6.2 16.6V9.4M9.9 16.6V5.2M13.6 16.6v-4.8" />
    </>
  ),
  Users: (
    <>
      <circle cx="8" cy="6.6" r="2.7" />
      <path d="M2.9 16.4v-.9a3.1 3.1 0 0 1 3.1-3.1h4a3.1 3.1 0 0 1 3.1 3.1v.9" />
      <path d="M13.6 4.4a2.6 2.6 0 0 1 0 4.9M15 12.6a3 3 0 0 1 2.2 2.9v.9" />
    </>
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const TOP_LINK = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition';
const TOP_ACTIVE = 'bg-brand-50 text-brand-700';
const TOP_IDLE = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

export function Layout() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeMenu = currentMenu(location.pathname);
  const [expanded, setExpanded] = useState<string[]>(() => (activeMenu ? [activeMenu] : []));
  const [mobileOpen, setMobileOpen] = useState(false);
  const firstRender = useRef(true);

  // Walking into a section opens its group, so the sidebar always shows where
  // you are without collapsing anything you opened by hand.
  useEffect(() => {
    if (!activeMenu) return;
    setExpanded((current) => (current.includes(activeMenu) ? current : [...current, activeMenu]));
  }, [activeMenu]);

  useEffect(() => {
    if (!firstRender.current) setMobileOpen(false);
    firstRender.current = false;
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleGroup = (label: string) =>
    setExpanded((current) =>
      current.includes(label) ? current.filter((entry) => entry !== label) : [...current, label],
    );

  const section = currentSection(location.pathname);

  return (
    <div className="min-h-full lg:pl-64">
      {/* Backdrop for the off-canvas sidebar on narrow screens. */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4">
          <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `${TOP_LINK} ${isActive ? TOP_ACTIVE : TOP_IDLE}`}
          >
            <NavIcon name="Dashboard" />
            Dashboard
          </NavLink>

          {MENUS.map((menu) => {
            const open = expanded.includes(menu.label);
            const active = activeMenu === menu.label;
            return (
              <div key={menu.label}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleGroup(menu.label)}
                  className={`${TOP_LINK} w-full ${active ? TOP_ACTIVE : TOP_IDLE}`}
                >
                  <NavIcon name={menu.label} />
                  {menu.label}
                  <svg
                    className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
                  </svg>
                </button>

                {open ? (
                  <div className="ml-[22px] mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                    {menu.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `block rounded-md px-3 py-1.5 text-sm transition ${
                            isActive
                              ? 'bg-brand-50 font-semibold text-brand-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          {isAdmin ? (
            <NavLink
              to="/users"
              className={({ isActive }) => `${TOP_LINK} ${isActive ? TOP_ACTIVE : TOP_IDLE}`}
            >
              <NavIcon name="Users" />
              Users
            </NavLink>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-1 py-1.5">
            <Avatar name={user?.name ?? '?'} size={32} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-slate-800">{user?.name}</div>
              <div className="truncate text-xs text-slate-500">{titleCase(user?.role ?? '')}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            onClick={() => {
              void signOut().then(() => navigate('/login'));
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <button
          type="button"
          className="btn-ghost -ml-1 px-2 lg:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((current) => !current)}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>

        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {section.map((part, index) => (
            <span key={part} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              <span
                className={
                  index === section.length - 1
                    ? 'truncate font-semibold text-slate-800'
                    : 'truncate text-slate-500'
                }
              >
                {part}
              </span>
            </span>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
