import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, FunnelIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { fmtCurrency, fmtDate, StatusBadge } from '../../components/utils';

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [pos, setPos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPOs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/purchase-orders', { params: { search, status: statusFilter, page, limit: 20 } });
      setPos(data.data);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchPOs(); }, [search, statusFilter, page]);

  const statuses = ['', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED'];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Purchase Orders</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total records</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/purchase/orders/new')}>
          <PlusIcon className="w-4 h-4" /> New Purchase Order
        </button>
      </div>

      {/* Filters */}
      <div className="card card-body py-3 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search PO number…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="input max-w-[180px]"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {statuses.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Expected Delivery</th>
              <th>Value</th>
              <th>Status</th>
              <th>Received %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : pos.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No purchase orders found.</td></tr>
            ) : pos.map(po => {
              const totalQty = po.items?.reduce((s, i) => s + parseFloat(i.quantityOrdered), 0) || 0;
              const receivedQty = po.items?.reduce((s, i) => s + parseFloat(i.quantityReceived), 0) || 0;
              const receivedPct = totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;
              return (
                <tr key={po.id}>
                  <td>
                    <button onClick={() => navigate(`/purchase/orders/${po.id}`)} className="text-primary-600 hover:underline font-medium">
                      {po.poNumber}
                    </button>
                  </td>
                  <td className="font-medium">{po.supplier?.name}</td>
                  <td className="text-gray-500">{fmtDate(po.createdAt)}</td>
                  <td className={po.expectedDeliveryDate && new Date(po.expectedDeliveryDate) < new Date() && !['FULLY_RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status) ? 'text-red-600 font-medium' : 'text-gray-500'}>
                    {fmtDate(po.expectedDeliveryDate)}
                  </td>
                  <td className="font-semibold">{fmtCurrency(po.grandTotal)}</td>
                  <td><StatusBadge status={po.status} /></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-600 rounded-full" style={{ width: `${receivedPct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{receivedPct}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/purchase/orders/${po.id}`)} className="btn-secondary btn-sm">View</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
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
