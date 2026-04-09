import { useEffect, useState, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { fmtCurrency, fmtDate, fmtQty } from '../../components/utils';

const MOVEMENT_COLORS = {
  PURCHASE_RECEIPT: 'badge-green',
  SALE: 'badge-blue',
  SALE_RETURN: 'badge-purple',
  ADJUSTMENT_IN: 'badge-green',
  ADJUSTMENT_OUT: 'badge-red',
  OPENING_STOCK: 'badge-gray',
  TRANSFER_IN: 'badge-green',
  TRANSFER_OUT: 'badge-amber',
};

export default function StockLedger() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [movementType, setMovementType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    api.get('/inventory/ledger', {
      params: {
        productId: productId || undefined,
        movementType: movementType || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page, limit: 30,
      },
    }).then(r => { setEntries(r.data.data || []); setTotal(r.data.total || 0); })
      .finally(() => setLoading(false));
  }, [productId, movementType, fromDate, toDate, page]);

  useEffect(() => {
    fetchEntries();
    api.get('/products', { params: { limit: 300 } }).then(r => setProducts(r.data.data || []));
  }, [fetchEntries]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Stock Ledger</h1>
          <p className="text-gray-500 text-sm mt-1">Immutable record of all stock movements</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input w-56" value={productId} onChange={e => { setProductId(e.target.value); setPage(1); }}>
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input w-48" value={movementType} onChange={e => { setMovementType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          {Object.keys(MOVEMENT_COLORS).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <input type="date" className="input w-40" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} />
        <input type="date" className="input w-40" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1); }} />
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Product</th>
              <th>Movement</th>
              <th className="text-right">Qty Change</th>
              <th className="text-right">Unit Cost</th>
              <th className="text-right">Total Value</th>
              <th>Reference</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No ledger entries found.</td></tr>
            ) : entries.map(e => {
              const isPositive = ['PURCHASE_RECEIPT', 'SALE_RETURN', 'ADJUSTMENT_IN', 'OPENING_STOCK', 'TRANSFER_IN'].includes(e.movementType);
              return (
                <tr key={e.id}>
                  <td className="text-gray-500 whitespace-nowrap">{fmtDate(e.createdAt, true)}</td>
                  <td className="font-medium">{e.product?.name}</td>
                  <td><span className={MOVEMENT_COLORS[e.movementType] || 'badge-gray'}>{e.movementType.replace(/_/g, ' ')}</span></td>
                  <td className={`text-right font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : '-'}{fmtQty(Math.abs(e.quantity), e.product?.unit)}
                  </td>
                  <td className="text-right">{fmtCurrency(e.unitCost || 0)}</td>
                  <td className="text-right">{fmtCurrency(Math.abs(e.quantity) * (e.unitCost || 0))}</td>
                  <td className="text-gray-500 text-xs">{e.referenceNumber || '—'}</td>
                  <td className="text-gray-500 text-xs max-w-xs truncate">{e.notes || '—'}</td>
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
