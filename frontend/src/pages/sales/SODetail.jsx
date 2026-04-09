import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtDate, getErrorMsg } from '../../components/utils';
import { useAuth } from '../../context/AuthContext';

export default function SODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [so, setSO] = useState(null);
  const [loading, setLoading] = useState(true);

  function fetchSO() {
    api.get(`/sales-orders/${id}`).then(r => setSO(r.data)).finally(() => setLoading(false));
  }

  useEffect(() => { fetchSO(); }, [id]);

  async function cancelOrder() {
    if (!window.confirm('Cancel this sales order? Reserved stock will be released.')) return;
    try {
      await api.patch(`/sales-orders/${id}/status`, { status: 'CANCELLED' });
      toast.success('Order cancelled');
      fetchSO();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!so) return <div className="text-center py-20 text-gray-400">Order not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1>{so.soNumber}</h1>
          <div className="flex gap-2 items-center mt-1">
            <StatusBadge status={so.status} />
            <span className="text-sm text-gray-500">Created {fmtDate(so.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {so.status === 'CONFIRMED' && (
            <button className="btn-primary"
              onClick={() => navigate(`/sales/invoices/new?soId=${so.id}&customerId=${so.customerId}`)}>
              Create Invoice
            </button>
          )}
          {['DRAFT', 'CONFIRMED'].includes(so.status) && hasRole('SALESPERSON', 'SUPER_ADMIN', 'PROCUREMENT_MANAGER') && (
            <button className="btn-danger" onClick={cancelOrder}>Cancel</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Grand Total</p>
          <p className="text-2xl font-bold">{fmtCurrency(so.grandTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Customer</p>
          <p className="text-lg font-semibold">{so.customer?.name}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Delivery Date</p>
          <p className="text-lg font-semibold">{so.deliveryDate ? fmtDate(so.deliveryDate) : 'N/A'}</p>
        </div>
      </div>

      <div className="card card-body">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><span className="text-gray-500">Order Date</span><p className="font-medium">{fmtDate(so.orderDate)}</p></div>
          <div><span className="text-gray-500">Payment Terms</span><p className="font-medium">{so.paymentTerms} days</p></div>
          <div><span className="text-gray-500">Status</span><p><StatusBadge status={so.status} /></p></div>
        </div>
        {so.notes && <p className="mt-3 text-sm text-gray-600">{so.notes}</p>}
      </div>

      <div className="card">
        <div className="card-header">Line Items</div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {so.items?.map((item, i) => (
                <tr key={item.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td className="font-medium">{item.product?.name}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{fmtCurrency(item.unitPrice)}</td>
                  <td className="text-right font-medium">{fmtCurrency(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4} className="text-right">Sub Total</td><td className="text-right">{fmtCurrency(so.subTotal)}</td></tr>
              <tr><td colSpan={4} className="text-right text-gray-500">Tax</td><td className="text-right text-gray-500">{fmtCurrency(so.taxAmount)}</td></tr>
              <tr><td colSpan={4} className="text-right font-bold">Grand Total</td><td className="text-right font-bold text-primary-700">{fmtCurrency(so.grandTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      {so.invoices?.length > 0 && (
        <div className="card">
          <div className="card-header">Linked Invoices</div>
          <div className="table-container">
            <table>
              <thead><tr><th>Invoice #</th><th>Date</th><th className="text-right">Total</th><th>Status</th></tr></thead>
              <tbody>
                {so.invoices.map(inv => (
                  <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/sales/invoices/${inv.id}`)}>
                    <td className="font-medium text-primary-600">{inv.invoiceNumber}</td>
                    <td className="text-gray-500">{fmtDate(inv.invoiceDate)}</td>
                    <td className="text-right">{fmtCurrency(inv.grandTotal)}</td>
                    <td><StatusBadge status={inv.status} /></td>
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
