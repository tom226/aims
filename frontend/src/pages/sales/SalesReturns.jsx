import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, ReceiptRefundIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtDate, getErrorMsg } from '../../components/utils';
import EmptyState from '../../components/EmptyState';

function CreateModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers?limit=200').then(({ data }) => setCustomers(data.data || data));
    api.get('/products?limit=500').then(({ data }) => setProducts(data.data || data));
  }, []);

  useEffect(() => {
    if (customerId) {
      api.get(`/invoices?customerId=${customerId}&limit=50`).then(({ data }) => setInvoices(data.data || data));
    } else setInvoices([]);
  }, [customerId]);

  function addItem() { setItems([...items, { productId: '', quantity: 1, unitPrice: 0, taxRate: 18 }]); }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i, key, val) {
    const next = [...items]; next[i] = { ...next[i], [key]: val };
    if (key === 'productId') {
      const p = products.find(x => x.id === val);
      if (p) { next[i].unitPrice = p.sellingPrice; next[i].taxRate = p.taxRate; }
    }
    setItems(next);
  }

  const total = items.reduce((s, it) => {
    const sub = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0);
    const tax = sub * (parseFloat(it.taxRate) || 0) / 100;
    return s + sub + tax;
  }, 0);

  async function save() {
    if (!customerId) return toast.error('Select customer');
    const valid = items.filter(it => it.productId && parseFloat(it.quantity) > 0);
    if (valid.length === 0) return toast.error('Add items');
    setSaving(true);
    try {
      await api.post('/sales-returns', {
        customerId, invoiceId: invoiceId || null, returnDate: date, reason,
        items: valid.map(it => ({
          productId: it.productId, quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice), taxRate: parseFloat(it.taxRate),
        })),
      });
      toast.success('Sales return created');
      onSaved();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg dark:text-white">New Sales Return / Credit Note</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Customer *</label>
              <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Against Invoice</label>
              <select className="input" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} disabled={!customerId}>
                <option value="">— None —</option>
                {invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Damaged goods, wrong item, etc." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold dark:text-white">Items</h3>
              <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-sm"><PlusIcon className="w-4 h-4" /> Add</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b dark:border-gray-700"><th className="py-2">Product</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {items.map((it, i) => {
                  const sub = (parseFloat(it.unitPrice) || 0) * (parseFloat(it.quantity) || 0);
                  const tax = sub * (parseFloat(it.taxRate) || 0) / 100;
                  return (
                    <tr key={i} className="border-b dark:border-gray-700">
                      <td className="py-2 pr-2">
                        <select className="input" value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                          <option value="">Select</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="pr-2 w-24"><input type="number" min="0" step="0.001" className="input" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
                      <td className="pr-2 w-28"><input type="number" min="0" step="0.01" className="input" value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)} /></td>
                      <td className="pr-2 w-20"><input type="number" min="0" step="0.01" className="input" value={it.taxRate} onChange={e => updateItem(i, 'taxRate', e.target.value)} /></td>
                      <td className="pr-2 w-28 dark:text-gray-200">{fmtCurrency(sub + tax)}</td>
                      <td className="w-10"><button onClick={() => removeItem(i)} className="text-red-600"><TrashIcon className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="text-right mt-3 text-lg font-semibold dark:text-white">Total: {fmtCurrency(total)}</div>
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}

export default function SalesReturns() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sales-returns');
      setList(data.data || data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(id, what) {
    if (!confirm(`${what} this return?`)) return;
    try {
      await api.post(`/sales-returns/${id}/${what.toLowerCase()}`);
      toast.success(`${what}d`);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Sales Returns / Credit Notes</h1>
        <button onClick={() => setShow(true)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-4 h-4" /> New Return</button>
      </div>
      <div className="card p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : list.length === 0 ? (
          <EmptyState icon={ReceiptRefundIcon} title="No sales returns" description="Issue credit notes for returned goods." action={<button onClick={() => setShow(true)} className="btn-primary">New Return</button>} />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.returnNumber}</td>
                    <td>{fmtDate(r.returnDate)}</td>
                    <td>{r.customer?.name}</td>
                    <td>{r.invoice?.invoiceNumber || '—'}</td>
                    <td>{fmtCurrency(r.grandTotal)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-right space-x-2">
                      {r.status === 'DRAFT' && <>
                        <button onClick={() => action(r.id, 'Confirm')} className="text-green-600 text-sm">Confirm</button>
                        <button onClick={() => action(r.id, 'Cancel')} className="text-red-600 text-sm">Cancel</button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <CreateModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}
