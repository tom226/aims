import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { fmtDate, StatusBadge } from '../../components/utils';

export default function GoodsReceipt() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/grn', { params: { page, limit: 20 } }).then(r => {
      setGrns(r.data.data || []);
      setTotal(r.data.total || 0);
    }).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Goods Receipt Notes</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total records</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/purchase/grn/new')}>
          <PlusIcon className="w-4 h-4" /> Receive Goods
        </button>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>GRN Number</th>
              <th>PO Number</th>
              <th>Supplier</th>
              <th>Received Date</th>
              <th>Status</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : grns.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No GRNs found.</td></tr>
            ) : grns.map(grn => (
              <tr key={grn.id}>
                <td className="font-medium text-primary-600">{grn.grnNumber}</td>
                <td>{grn.purchaseOrder?.poNumber}</td>
                <td>{grn.purchaseOrder?.supplier?.name}</td>
                <td className="text-gray-500">{fmtDate(grn.receivedDate)}</td>
                <td><StatusBadge status={grn.status} /></td>
                <td>{grn.items?.length} items</td>
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
