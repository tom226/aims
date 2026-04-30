import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon, ArrowsRightLeftIcon, EyeIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtDate, getErrorMsg } from '../../components/utils';
import EmptyState from '../../components/EmptyState';

export default function StockTransfers() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stock-transfers');
      setList(data.data || data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function complete(id) {
    if (!confirm('Mark transfer as completed? This will move stock between warehouses.')) return;
    try {
      await api.post(`/stock-transfers/${id}/complete`);
      toast.success('Transfer completed');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  async function cancel(id) {
    if (!confirm('Cancel this transfer?')) return;
    try {
      await api.post(`/stock-transfers/${id}/cancel`);
      toast.success('Cancelled');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Stock Transfers</h1>
        <Link to="/inventory/transfers/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> New Transfer
        </Link>
      </div>
      <div className="card p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : list.length === 0 ? (
          <EmptyState icon={ArrowsRightLeftIcon} title="No transfers yet" description="Move stock between warehouses to keep inventory balanced." action={
            <Link to="/inventory/transfers/new" className="btn-primary">New Transfer</Link>
          } />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead><tr>
                <th>Number</th><th>Date</th><th>From</th><th>To</th><th>Items</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {list.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.transferNumber}</td>
                    <td>{fmtDate(t.transferDate)}</td>
                    <td>{t.fromWarehouse?.name}</td>
                    <td>{t.toWarehouse?.name}</td>
                    <td>{t.items?.length || 0}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="text-right space-x-2">
                      {t.status === 'IN_TRANSIT' && (
                        <>
                          <button onClick={() => complete(t.id)} className="text-green-600 hover:text-green-800 text-sm">Complete</button>
                          <button onClick={() => cancel(t.id)} className="text-red-600 hover:text-red-800 text-sm">Cancel</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
