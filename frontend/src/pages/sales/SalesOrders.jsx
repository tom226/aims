import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtDate } from '../../components/utils';

const STATUS_OPTIONS = ['', 'DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED', 'CANCELLED'];

export default function SalesOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('/sales-orders', { params: { search: search || undefined, status: status || undefined, page, limit: 20 } })
      .then(r => { setOrders(r.data.data || []); setTotal(r.data.total || 0); })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Sales Orders</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total orders</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/sales/orders/new')}>
          <PlusIcon className="w-4 h-4" /> New Order
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by SO number or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-48" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>SO Number</th>
              <th>Customer</th>
              <th>Order Date</th>
              <th>Delivery Date</th>
              <th className="text-right">Items</th>
              <th className="text-right">Grand Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sales orders found.</td></tr>
            ) : orders.map(so => (
              <tr key={so.id} className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/sales/orders/${so.id}`)}>
                <td className="font-medium text-primary-600">{so.soNumber}</td>
                <td>{so.customer?.name}</td>
                <td className="text-gray-500">{fmtDate(so.orderDate)}</td>
                <td className="text-gray-500">{so.deliveryDate ? fmtDate(so.deliveryDate) : '—'}</td>
                <td className="text-right">{so.items?.length || 0}</td>
                <td className="text-right font-medium">{fmtCurrency(so.grandTotal)}</td>
                <td><StatusBadge status={so.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">Previous</button>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
