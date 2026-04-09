import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, TruckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtCurrency, fmtDate, StatusBadge, getErrorMsg } from '../../components/utils';

export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchPO = async () => {
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data);
    } catch { toast.error('PO not found'); navigate(-1); }
    setLoading(false);
  };

  useEffect(() => { fetchPO(); }, [id]);

  const updateStatus = async (status) => {
    setStatusLoading(true);
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status });
      toast.success(`PO status updated to ${status.replace(/_/g, ' ')}`);
      fetchPO();
    } catch (err) { toast.error(getErrorMsg(err)); }
    setStatusLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!po) return null;

  const totalOrdered = po.items?.reduce((s, i) => s + parseFloat(i.quantityOrdered), 0) || 0;
  const totalReceived = po.items?.reduce((s, i) => s + parseFloat(i.quantityReceived), 0) || 0;
  const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm"><ChevronLeftIcon className="w-4 h-4" /> Back</button>
        <div>
          <h1>{po.poNumber}</h1>
          <p className="text-gray-500 text-sm">Created {fmtDate(po.createdAt)} by {po.createdBy?.name}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <StatusBadge status={po.status} />
          {po.status === 'DRAFT' && <button className="btn-primary btn-sm" onClick={() => updateStatus('APPROVED')} disabled={statusLoading}>Approve PO</button>}
          {po.status === 'APPROVED' && <button className="btn-primary btn-sm" onClick={() => updateStatus('SENT')} disabled={statusLoading}>Mark as Sent</button>}
          {['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
            <button className="btn-success btn-sm" onClick={() => navigate(`/purchase/grn/new?poId=${id}`)}>
              <TruckIcon className="w-4 h-4" /> Receive Goods
            </button>
          )}
          {!['CLOSED', 'CANCELLED', 'FULLY_RECEIVED'].includes(po.status) && (
            <button className="btn-danger btn-sm" onClick={() => updateStatus('CANCELLED')} disabled={statusLoading}>Cancel PO</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Supplier', value: po.supplier?.name },
          { label: 'Grand Total', value: fmtCurrency(po.grandTotal) },
          { label: 'Expected Delivery', value: fmtDate(po.expectedDeliveryDate) },
          { label: 'Payment Terms', value: po.paymentTerms || '—' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="font-semibold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Receipt Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Receipt Progress</span>
          <span className="text-sm font-bold text-primary-600">{receivedPct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${receivedPct}%` }} />
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header"><h3>Line Items</h3></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Product</th><th>SKU</th><th>Ordered</th><th>Received</th><th>Pending</th><th>Unit Price</th><th>Tax</th><th>Total</th></tr></thead>
            <tbody>
              {po.items?.map(item => {
                const pending = parseFloat(item.quantityOrdered) - parseFloat(item.quantityReceived);
                return (
                  <tr key={item.id}>
                    <td className="font-medium">{item.product?.name}</td>
                    <td className="text-gray-400">{item.product?.sku}</td>
                    <td>{parseFloat(item.quantityOrdered)}</td>
                    <td className="text-green-700 font-medium">{parseFloat(item.quantityReceived)}</td>
                    <td className={pending > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{pending > 0 ? pending : '—'}</td>
                    <td>{fmtCurrency(item.unitPrice)}</td>
                    <td>{parseFloat(item.taxRate)}%</td>
                    <td className="font-semibold">{fmtCurrency(item.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex justify-end">
          <div className="text-sm space-y-1 min-w-[200px]">
            <div className="flex justify-between"><span>Sub Total:</span><span>{fmtCurrency(po.subTotal)}</span></div>
            <div className="flex justify-between"><span>Tax:</span><span>{fmtCurrency(po.taxAmount)}</span></div>
            <div className="flex justify-between"><span>Additional:</span><span>{fmtCurrency(po.additionalCharges)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Grand Total:</span><span>{fmtCurrency(po.grandTotal)}</span></div>
          </div>
        </div>
      </div>

      {/* GRNs */}
      {po.grns?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Goods Receipt Notes</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>GRN Number</th><th>Date</th><th>Status</th><th>Items</th></tr></thead>
              <tbody>
                {po.grns.map(grn => (
                  <tr key={grn.id}>
                    <td className="font-medium text-primary-600">{grn.grnNumber}</td>
                    <td>{fmtDate(grn.receivedDate)}</td>
                    <td><StatusBadge status={grn.status} /></td>
                    <td>{grn.items?.length} items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
