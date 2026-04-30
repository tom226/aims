import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtCurrency, fmtDate, getErrorMsg } from '../../components/utils';
import EmptyState from '../../components/EmptyState';

const PAYMENT_MODES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CREDIT_CARD', 'DEBIT_CARD', 'OTHER'];

function PaymentModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({
    customerId: '', invoiceId: '', amount: '', paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: 'BANK_TRANSFER', referenceNo: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers?limit=200').then(({ data }) => setCustomers(data.data || data)); }, []);
  useEffect(() => {
    if (form.customerId) {
      api.get(`/invoices?customerId=${form.customerId}&limit=50`).then(({ data }) => {
        const list = (data.data || data).filter(inv => parseFloat(inv.grandTotal) > parseFloat(inv.amountPaid));
        setInvoices(list);
      });
    } else setInvoices([]);
  }, [form.customerId]);

  function f(k) { return { value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) }; }

  function pickInvoice(invId) {
    const inv = invoices.find(i => i.id === invId);
    setForm(prev => ({
      ...prev, invoiceId: invId,
      amount: inv ? (parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid)).toFixed(2) : prev.amount,
    }));
  }

  async function save() {
    if (!form.customerId) return toast.error('Select customer');
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter amount');
    setSaving(true);
    try {
      await api.post('/payments', { ...form, invoiceId: form.invoiceId || null, amount: parseFloat(form.amount) });
      toast.success('Payment recorded');
      onSaved();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg dark:text-white">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Customer *</label>
              <select className="input" {...f('customerId')}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Against Invoice</label>
              <select className="input" value={form.invoiceId} onChange={e => pickInvoice(e.target.value)} disabled={!form.customerId}>
                <option value="">— Advance / On account —</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Due {fmtCurrency(parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid))}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount *</label>
              <input type="number" min="0" step="0.01" className="input" {...f('amount')} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" {...f('paymentDate')} />
            </div>
            <div>
              <label className="label">Payment Mode *</label>
              <select className="input" {...f('paymentMode')}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Reference No.</label>
              <input className="input" placeholder="UTR / Cheque #" {...f('referenceNo')} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" {...f('notes')} />
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Record'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Payments() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/payments');
      setList(data.data || data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Customer Payments</h1>
        <button onClick={() => setShow(true)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-4 h-4" /> Record Payment</button>
      </div>
      <div className="card p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : list.length === 0 ? (
          <EmptyState icon={BanknotesIcon} title="No payments recorded" description="Track customer payments and outstanding balances." action={<button onClick={() => setShow(true)} className="btn-primary">Record Payment</button>} />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.paymentNumber}</td>
                    <td>{fmtDate(p.paymentDate)}</td>
                    <td>{p.customer?.name}</td>
                    <td>{p.invoice?.invoiceNumber || <span className="text-gray-400">On account</span>}</td>
                    <td>{p.paymentMode?.replace('_', ' ')}</td>
                    <td>{p.referenceNo || '—'}</td>
                    <td className="text-right font-semibold">{fmtCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <PaymentModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}
