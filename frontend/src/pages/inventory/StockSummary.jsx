import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';
import { fmtCurrency, fmtQty } from '../../components/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

function StockStatusBadge({ product }) {
  const avail = product.currentStock - (product.reservedStock || 0);
  if (avail <= 0) return <span className="badge-red">Out of Stock</span>;
  if (avail <= product.reorderPoint) return <span className="badge-amber">Low Stock</span>;
  return <span className="badge-green">In Stock</span>;
}

export default function StockSummary() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = { page, limit: 30, search: search || undefined };
    if (stockFilter === 'LOW') params.lowStock = 'true';
    if (stockFilter === 'OUT') params.outOfStock = 'true';
    api.get('/inventory/stock-summary', { params })
      .then(r => { setProducts(r.data.data || []); setTotal(r.data.total || 0); })
      .catch(() => {
        // fallback to products endpoint
        api.get('/products', { params }).then(r => { setProducts(r.data.data || []); setTotal(r.data.total || 0); });
      })
      .finally(() => setLoading(false));
  }, [search, stockFilter, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const totalValue = products.reduce((s, p) => s + p.currentStock * p.costPrice, 0);
  const lowStockCount = products.filter(p => {
    const avail = p.currentStock - (p.reservedStock || 0);
    return avail > 0 && avail <= p.reorderPoint;
  }).length;
  const outCount = products.filter(p => (p.currentStock - (p.reservedStock || 0)) <= 0).length;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Stock Summary</h1>
          <p className="text-gray-500 text-sm mt-1">{total} products</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Inventory Value</p>
          <p className="text-2xl font-bold text-gray-900">{fmtCurrency(totalValue)}</p>
          <p className="text-xs text-gray-400 mt-1">At cost price</p>
        </div>
        <div className="stat-card cursor-pointer hover:border-amber-400 border border-transparent transition-colors"
          onClick={() => setStockFilter(stockFilter === 'LOW' ? '' : 'LOW')}>
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-amber-500">{lowStockCount}</p>
          <p className="text-xs text-gray-400 mt-1">Below reorder point</p>
        </div>
        <div className="stat-card cursor-pointer hover:border-red-400 border border-transparent transition-colors"
          onClick={() => setStockFilter(stockFilter === 'OUT' ? '' : 'OUT')}>
          <p className="text-sm text-gray-500">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{outCount}</p>
          <p className="text-xs text-gray-400 mt-1">Available = 0</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search products…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-2">
          {['', 'LOW', 'OUT'].map(f => (
            <button key={f} onClick={() => { setStockFilter(f); setPage(1); }}
              className={`btn-sm ${stockFilter === f ? 'btn-primary' : 'btn-secondary'}`}>
              {f === '' ? 'All' : f === 'LOW' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="text-right">In Stock</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Available</th>
              <th className="text-right">Reorder Pt.</th>
              <th className="text-right">Cost Price</th>
              <th className="text-right">Stock Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">No products match the filter.</td></tr>
            ) : products.map(p => {
              const avail = p.currentStock - (p.reservedStock || 0);
              const stockValue = p.currentStock * p.costPrice;
              return (
                <tr key={p.id} className={avail <= 0 ? 'bg-red-50' : avail <= p.reorderPoint ? 'bg-amber-50' : ''}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-gray-500">{p.sku || '—'}</td>
                  <td className="text-gray-500">{p.category?.name || '—'}</td>
                  <td className="text-right">{fmtQty(p.currentStock, p.unit)}</td>
                  <td className="text-right text-gray-500">{p.reservedStock || 0}</td>
                  <td className={`text-right font-semibold ${avail <= 0 ? 'text-red-600' : avail <= p.reorderPoint ? 'text-amber-600' : 'text-green-600'}`}>
                    {fmtQty(avail, p.unit)}
                  </td>
                  <td className="text-right">{p.reorderPoint}</td>
                  <td className="text-right">{fmtCurrency(p.costPrice)}</td>
                  <td className="text-right font-medium">{fmtCurrency(stockValue)}</td>
                  <td><StockStatusBadge product={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 30 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">Previous</button>
            <button disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
