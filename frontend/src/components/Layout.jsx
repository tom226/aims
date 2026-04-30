import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HomeIcon, ShoppingCartIcon, DocumentTextIcon, ClipboardDocumentListIcon,
  CubeIcon, ChartBarIcon, UsersIcon, Cog6ToothIcon,
  ChevronDownIcon, ArrowRightOnRectangleIcon, Bars3Icon,
  BuildingStorefrontIcon, ReceiptPercentIcon, AdjustmentsHorizontalIcon,
  ArchiveBoxIcon, MagnifyingGlassIcon, SunIcon, MoonIcon,
  ArrowsRightLeftIcon, BuildingOffice2Icon, ArrowPathIcon, TruckIcon,
  BanknotesIcon, QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';
import ShortcutsHelp from './ShortcutsHelp';
import clsx from 'clsx';

const nav = [
  { label: 'Dashboard', to: '/dashboard', icon: HomeIcon },
  {
    label: 'Purchase', icon: ShoppingCartIcon, children: [
      { label: 'Purchase Orders', to: '/purchase/orders', icon: DocumentTextIcon },
      { label: 'Goods Receipt', to: '/purchase/grn', icon: ArchiveBoxIcon },
      { label: 'Purchase Returns', to: '/purchase/returns', icon: ArrowPathIcon },
      { label: 'Suppliers', to: '/purchase/suppliers', icon: BuildingStorefrontIcon },
    ],
  },
  {
    label: 'Sales', icon: ReceiptPercentIcon, children: [
      { label: 'Sales Orders', to: '/sales/orders', icon: ClipboardDocumentListIcon },
      { label: 'Invoices', to: '/sales/invoices', icon: DocumentTextIcon },
      { label: 'Delivery Challans', to: '/sales/challans', icon: TruckIcon },
      { label: 'Sales Returns', to: '/sales/returns', icon: ArrowPathIcon },
      { label: 'Payments', to: '/sales/payments', icon: BanknotesIcon },
      { label: 'Customers', to: '/sales/customers', icon: UsersIcon },
    ],
  },
  {
    label: 'Inventory', icon: CubeIcon, children: [
      { label: 'Products', to: '/inventory/products', icon: CubeIcon },
      { label: 'Stock Summary', to: '/inventory/stock', icon: ArchiveBoxIcon },
      { label: 'Stock Ledger', to: '/inventory/ledger', icon: ClipboardDocumentListIcon },
      { label: 'Adjustments', to: '/inventory/adjustments', icon: AdjustmentsHorizontalIcon },
      { label: 'Warehouses', to: '/inventory/warehouses', icon: BuildingOffice2Icon },
      { label: 'Stock Transfers', to: '/inventory/transfers', icon: ArrowsRightLeftIcon },
    ],
  },
  { label: 'Reports', to: '/reports', icon: ChartBarIcon },
  {
    label: 'Settings', icon: Cog6ToothIcon, children: [
      { label: 'Users & Roles', to: '/settings/users', icon: UsersIcon },
    ],
  },
];

function NavSection({ item, collapsed }) {
  const [open, setOpen] = useState(true);

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) => clsx('sidebar-item', isActive && 'sidebar-item-active')}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-item w-full justify-between"
      >
        <span className="flex items-center gap-3">
          <item.icon className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="font-semibold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">{item.label}</span>}
        </span>
        {!collapsed && (
          <ChevronDownIcon className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
          {item.children.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) => clsx('sidebar-item text-xs', isActive && 'sidebar-item-active')}
            >
              <child.icon className="w-3.5 h-3.5 shrink-0" />
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Sequence buffer for "g d", "n p" etc.
  const seqRef = useRef({ key: '', timer: null });

  const isTypingTarget = useCallback((el) => {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }, []);

  useEffect(() => {
    function onKey(e) {
      // Ctrl/Cmd+K opens palette anywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (isTypingTarget(e.target)) return;

      // Esc closes overlays
      if (e.key === 'Escape') { setPaletteOpen(false); setHelpOpen(false); return; }

      // Shift+D toggles dark mode
      if (e.shiftKey && e.key === 'D') { e.preventDefault(); toggleTheme(); return; }

      // ? opens help
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); return; }

      // Sequence shortcuts
      const k = e.key.toLowerCase();
      if (seqRef.current.key) {
        const combo = seqRef.current.key + k;
        clearTimeout(seqRef.current.timer);
        seqRef.current = { key: '', timer: null };
        const map = {
          gd: '/dashboard', gp: '/inventory/products', gs: '/inventory/stock',
          go: '/purchase/orders', gi: '/sales/invoices', gc: '/sales/customers',
          gr: '/reports', np: '/purchase/orders/new', ns: '/sales/orders/new',
          ni: '/sales/invoices/new',
        };
        if (map[combo]) { e.preventDefault(); navigate(map[combo]); return; }
      } else if (k === 'g' || k === 'n') {
        seqRef.current.key = k;
        seqRef.current.timer = setTimeout(() => { seqRef.current = { key: '', timer: null }; }, 800);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, toggleTheme, isTypingTarget]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-200 z-30 shrink-0',
        'fixed inset-y-0 left-0 lg:static',
        collapsed ? 'w-16' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">AIMS</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hidden lg:flex"
            title="Collapse sidebar"
          >
            <Bars3Icon className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {nav.map((item, i) => (
            <NavSection key={i} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <div className={clsx('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={handleLogout} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 transition-colors" title="Logout">
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Branding */}
        <div className="px-3 pb-3">
          <p className={clsx('text-xs text-gray-400 dark:text-gray-500 text-center', collapsed && 'hidden')}>
            Built by{' '}
            <a
              href="https://www.automarklabs.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
            >
              Automark Labs
            </a>
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 shrink-0 gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-72 lg:w-96"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span className="flex-1 text-left">Search products, pages, actions…</span>
            <span className="kbd">Ctrl</span><span className="kbd">K</span>
          </button>

          <div className="flex-1 md:hidden" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              title="Keyboard shortcuts (?)"
            >
              <QuestionMarkCircleIcon className="w-5 h-5" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              title="Toggle theme (Shift+D)"
            >
              {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <NotificationBell />
            <span className="text-xs text-gray-500 hidden sm:block">
              {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
