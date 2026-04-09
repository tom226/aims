import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtDate, getErrorMsg } from '../../components/utils';
import { useAuth } from '../../context/AuthContext';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm({
    defaultValues: { amount: '', paymentDate: new Date().toISOString().split('T')[0], method: 'BANK_TRANSFER', reference: '' },
  });

  function fetchInvoice() {
    api.get(`/invoices/${id}`).then(r => setInvoice(r.data)).finally(() => setLoading(false));
  }

  useEffect(() => { fetchInvoice(); }, [id]);

  async function recordPayment(data) {
    try {
      await api.post(`/invoices/${id}/record-payment`, {
        amount: Number(data.amount),
        paymentDate: data.paymentDate,
        paymentMethod: data.method,
        reference: data.reference || undefined,
      });
      toast.success('Payment recorded');
      setPayModal(false);
      reset();
      fetchInvoice();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  async function cancelInvoice() {
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try {
      await api.patch(`/invoices/${id}/cancel`);
      toast.success('Invoice cancelled');
      fetchInvoice();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (!invoice) return <div className="text-center py-20 text-gray-400">Invoice not found.</div>;

  const balance = invoice.grandTotal - (invoice.amountPaid || 0);
  const isOpen = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1>{invoice.invoiceNumber}</h1>
          <div className="flex gap-2 items-center mt-1">
            <StatusBadge status={invoice.status} />
            <span className="text-sm text-gray-500">Issued {fmtDate(invoice.invoiceDate)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isOpen && hasRole('FINANCE_MANAGER', 'SUPER_ADMIN') && (
            <button className="btn-success" onClick={() => setPayModal(true)}>Record Payment</button>
          )}
          {invoice.status !== 'CANCELLED' && invoice.status !== 'PAID' && hasRole('FINANCE_MANAGER', 'SUPER_ADMIN') && (
            <button className="btn-danger" onClick={cancelInvoice}>Cancel</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Grand Total</p>
          <p className="text-2xl font-bold text-gray-900">{fmtCurrency(invoice.grandTotal)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Amount Paid</p>
          <p className="text-2xl font-bold text-green-600">{fmtCurrency(invoice.amountPaid || 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Balance Due</p>
          <p className={`text-2xl font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCurrency(balance)}</p>
        </div>
      </div>

      {/* Details */}
      <div className="card card-body">
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Invoice Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium">{invoice.customer?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Invoice Date</span><span>{fmtDate(invoice.invoiceDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span className={invoice.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''}>{fmtDate(invoice.dueDate)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Payment Terms</span><span>{invoice.paymentTerms} days</span></div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Source Documents</h3>
            <div className="space-y-2">
              {invoice.salesOrder && (
                <div className="flex justify-between"><span className="text-gray-500">Sales Order</span>
                  <button className="text-primary-600 font-medium" onClick={() => navigate(`/sales/orders/${invoice.salesOrder.id}`)}>
                    {invoice.salesOrder.soNumber}
                  </button>
                </div>
              )}
              {invoice.purchaseOrder && (
                <div className="flex justify-between"><span className="text-gray-500">Purchase Order</span>
                  <button className="text-primary-600 font-medium" onClick={() => navigate(`/purchase/orders/${invoice.purchaseOrder.id}`)}>
                    {invoice.purchaseOrder.poNumber}
                  </button>
                </div>
              )}
              {!invoice.salesOrder && !invoice.purchaseOrder && (
                <p className="text-gray-400">Fresh invoice (no linked order)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
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
                <th className="text-right">Tax</th>
                <th className="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, i) => (
                <tr key={item.id}>
                  <td className="text-gray-400">{i + 1}</td>
                  <td className="font-medium">{item.product?.name}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{fmtCurrency(item.unitPrice)}</td>
                  <td className="text-right text-gray-500">{fmtCurrency(item.taxAmount || 0)}</td>
                  <td className="text-right font-medium">{fmtCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} className="text-right">Sub Total</td><td className="text-right">{fmtCurrency(invoice.subTotal)}</td></tr>
              <tr><td colSpan={5} className="text-right text-gray-500">Tax</td><td className="text-right text-gray-500">{fmtCurrency(invoice.taxAmount)}</td></tr>
              <tr><td colSpan={5} className="text-right font-bold">Grand Total</td><td className="text-right font-bold text-primary-700">{fmtCurrency(invoice.grandTotal)}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>

      {invoice.notes && (
        <div className="card card-body">
          <h3 className="font-semibold text-sm text-gray-700 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{invoice.notes}</p>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold">Record Payment</h2>
              <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit(recordPayment)} className="p-5 space-y-4">
              <div>
                <label className="label">Amount *</label>
                <input type="number" min={0.01} step="0.01" max={balance} className="input"
                  {...register('amount', { required: true, min: 0.01, max: balance, valueAsNumber: true })} />
                <p className="text-xs text-gray-400 mt-1">Balance due: {fmtCurrency(balance)}</p>
              </div>
              <div>
                <label className="label">Payment Date *</label>
                <input type="date" className="input" {...register('paymentDate', { required: true })} />
              </div>
              <div>
                <label className="label">Payment Method</label>
                <select className="input" {...register('method')}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Reference / UTR</label>
                <input className="input" placeholder="Transaction ID or cheque no." {...register('reference')} />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-success">
                  {isSubmitting ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
