import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HomeIcon, ShoppingCartIcon, DocumentTextIcon, ClipboardDocumentListIcon,
  CubeIcon, ChartBarIcon, UsersIcon, BuildingStorefrontIcon, ReceiptPercentIcon,
  AdjustmentsHorizontalIcon, ArchiveBoxIcon, MagnifyingGlassIcon, ArrowPathIcon,
  PlusIcon, TruckIcon, ArrowsRightLeftIcon, BanknotesIcon, BuildingOffice2Icon,
} from '@heroicons/react/24/outline';
import api from '../lib/api';

const ACTIONS = [
  { id: 'go-dashboard', label: 'Go to Dashboard', shortcut: 'g d', icon: HomeIcon, to: '/dashboard', group: 'Navigation' },
  { id: 'go-products', label: 'Go to Products', shortcut: 'g p', icon: CubeIcon, to: '/inventory/products', group: 'Navigation' },
  { id: 'go-stock', label: 'Go to Stock Summary', shortcut: 'g s', icon: ArchiveBoxIcon, to: '/inventory/stock', group: 'Navigation' },
  { id: 'go-ledger', label: 'Go to Stock Ledger', icon: ClipboardDocumentListIcon, to: '/inventory/ledger', group: 'Navigation' },
  { id: 'go-adj', label: 'Go to Stock Adjustments', icon: AdjustmentsHorizontalIcon, to: '/inventory/adjustments', group: 'Navigation' },
  { id: 'go-warehouses', label: 'Go to Warehouses', icon: BuildingOffice2Icon, to: '/inventory/warehouses', group: 'Navigation' },
  { id: 'go-transfers', label: 'Go to Stock Transfers', icon: ArrowsRightLeftIcon, to: '/inventory/transfers', group: 'Navigation' },
  { id: 'go-po', label: 'Go to Purchase Orders', shortcut: 'g o', icon: DocumentTextIcon, to: '/purchase/orders', group: 'Navigation' },
  { id: 'go-grn', label: 'Go to Goods Receipt (GRN)', icon: ArchiveBoxIcon, to: '/purchase/grn', group: 'Navigation' },
  { id: 'go-suppliers', label: 'Go to Suppliers', icon: BuildingStorefrontIcon, to: '/purchase/suppliers', group: 'Navigation' },
  { id: 'go-preturns', label: 'Go to Purchase Returns (Debit Notes)', icon: ArrowPathIcon, to: '/purchase/returns', group: 'Navigation' },
  { id: 'go-so', label: 'Go to Sales Orders', icon: ClipboardDocumentListIcon, to: '/sales/orders', group: 'Navigation' },
  { id: 'go-invoices', label: 'Go to Invoices', shortcut: 'g i', icon: ReceiptPercentIcon, to: '/sales/invoices', group: 'Navigation' },
  { id: 'go-customers', label: 'Go to Customers', shortcut: 'g c', icon: UsersIcon, to: '/sales/customers', group: 'Navigation' },
  { id: 'go-sreturns', label: 'Go to Sales Returns (Credit Notes)', icon: ArrowPathIcon, to: '/sales/returns', group: 'Navigation' },
  { id: 'go-challan', label: 'Go to Delivery Challans', icon: TruckIcon, to: '/sales/challans', group: 'Navigation' },
  { id: 'go-payments', label: 'Go to Payments', icon: BanknotesIcon, to: '/sales/payments', group: 'Navigation' },
  { id: 'go-reports', label: 'Go to Reports', shortcut: 'g r', icon: ChartBarIcon, to: '/reports', group: 'Navigation' },
  // Create actions
  { id: 'new-product', label: 'New Product', icon: PlusIcon, to: '/inventory/products?new=1', group: 'Create' },
  { id: 'new-po', label: 'New Purchase Order', shortcut: 'n p', icon: PlusIcon, to: '/purchase/orders/new', group: 'Create' },
  { id: 'new-so', label: 'New Sales Order', shortcut: 'n s', icon: PlusIcon, to: '/sales/orders/new', group: 'Create' },
  { id: 'new-invoice', label: 'New Invoice', shortcut: 'n i', icon: PlusIcon, to: '/sales/invoices/new', group: 'Create' },
  { id: 'new-grn', label: 'New Goods Receipt', icon: PlusIcon, to: '/purchase/grn/new', group: 'Create' },
  { id: 'new-transfer', label: 'New Stock Transfer', icon: PlusIcon, to: '/inventory/transfers/new', group: 'Create' },
  { id: 'new-supplier', label: 'New Supplier', icon: PlusIcon, to: '/purchase/suppliers?new=1', group: 'Create' },
  { id: 'new-customer', label: 'New Customer', icon: PlusIcon, to: '/sales/customers?new=1', group: 'Create' },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [products, setProducts] = useState([]);
  const inputRef = useRef(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
      // load lightweight product list once when opened
      if (products.length === 0) {
        api.get('/products', { params: { limit: 100 } })
          .then((r) => setProducts(r.data.data || []))
          .catch(() => {});
      }
    }
  }, [open, products.length]);

  // Filter
  useEffect(() => {
    const q = query.trim().toLowerCase();
    const productHits = q
      ? products
          .filter((p) => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q))
          .slice(0, 8)
          .map((p) => ({
            id: `prod-${p.id}`,
            label: p.name,
            sub: `${p.sku || '—'} • Stock: ${p.currentStock}`,
            icon: CubeIcon,
            to: `/inventory/products?focus=${p.id}`,
            group: 'Products',
          }))
      : [];

    const actionHits = q
      ? ACTIONS.filter((a) => a.label.toLowerCase().includes(q))
      : ACTIONS;

    setResults([...actionHits, ...productHits]);
    setActiveIdx(0);
  }, [query, products]);

  const grouped = useMemo(() => {
    const groups = {};
    results.forEach((r) => {
      const g = r.group || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(r);
    });
    return groups;
  }, [results]);

  const flat = results;

  function exec(item) {
    onClose();
    if (item.to) navigate(item.to);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flat[activeIdx]) { e.preventDefault(); exec(flat[activeIdx]); }
    else if (e.key === 'Escape') onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, products…"
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {flat.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No matches.</p>
          ) : (
            Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName} className="py-2">
                <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{groupName}</p>
                {items.map((item) => {
                  const idx = flat.indexOf(item);
                  const Icon = item.icon || MagnifyingGlassIcon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => exec(item)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                        idx === activeIdx
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.sub && <span className="text-xs text-gray-400 truncate">{item.sub}</span>}
                      {item.shortcut && (
                        <span className="flex gap-1">
                          {item.shortcut.split(' ').map((k, i) => <span key={i} className="kbd">{k.toUpperCase()}</span>)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[10px] text-gray-500 flex items-center gap-4">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
          <span><span className="kbd">↵</span> open</span>
          <span className="ml-auto">Tip: press <span className="kbd">?</span> for shortcuts</span>
        </div>
      </div>
    </div>
  );
}
