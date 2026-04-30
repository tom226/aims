import { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, TruckIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtDate, getErrorMsg } from '../../components/utils';
import EmptyState from '../../components/EmptyState';

function CreateModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customerId: '', challanDate: new Date().toISOString().slice(0, 10),
    vehicleNumber: '', driverName: '', driverPhone: '', transporter: '', shippingAddress: '', notes: '',
  });
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers?limit=200').then(({ data }) => setCustomers(data.data || data));
    api.get('/products?limit=500').then(({ data }) => setProducts(data.data || data));
  }, []);

  function addItem() { setItems([...items, { productId: '', quantity: 1 }]); }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i, key, val) { const next = [...items]; next[i] = { ...next[i], [key]: val }; setItems(next); }
  function f(k) { return { value: form[k], onChange: e => setForm({ ...form, [k]: e.target.value }) }; }

  async function save() {
    if (!form.customerId) return toast.error('Select customer');
    const valid = items.filter(it => it.productId && parseFloat(it.quantity) > 0);
    if (valid.length === 0) return toast.error('Add items');
    setSaving(true);
    try {
      await api.post('/delivery-challans', {
        ...form,
        items: valid.map(it => ({ productId: it.productId, quantity: parseFloat(it.quantity) })),
      });
      toast.success('Challan created');
      onSaved();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg dark:text-white">New Delivery Challan</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Customer *</label>
              <select className="input" {...f('customerId')}>
                <option value="">Select...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Challan Date</label><input type="date" className="input" {...f('challanDate')} /></div>
            <div><label className="label">Transporter</label><input className="input" {...f('transporter')} /></div>
            <div><label className="label">Vehicle Number</label><input className="input" {...f('vehicleNumber')} /></div>
            <div><label className="label">Driver Name</label><input className="input" {...f('driverName')} /></div>
            <div><label className="label">Driver Phone</label><input className="input" {...f('driverPhone')} /></div>
          </div>
          <div>
            <label className="label">Shipping Address</label>
            <textarea className="input" rows="2" {...f('shippingAddress')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" {...f('notes')} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold dark:text-white">Items</h3>
              <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-sm"><PlusIcon className="w-4 h-4" /> Add</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b dark:border-gray-700"><th className="py-2">Product</th><th>Qty</th><th></th></tr></thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b dark:border-gray-700">
                    <td className="py-2 pr-2">
                      <select className="input" value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                        <option value="">Select</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className="pr-2 w-32"><input type="number" min="0" step="0.001" className="input" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
                    <td className="w-10"><button onClick={() => removeItem(i)} className="text-red-600"><TrashIcon className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default function DeliveryChallans() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-challans');
      setList(data.data || data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(id, what) {
    if (!confirm(`${what} this challan?`)) return;
    try {
      await api.post(`/delivery-challans/${id}/${what.toLowerCase()}`);
      toast.success(`${what}d`);
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Delivery Challans</h1>
        <button onClick={() => setShow(true)} className="btn-primary flex items-center gap-2"><PlusIcon className="w-4 h-4" /> New Challan</button>
      </div>
      <div className="card p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : list.length === 0 ? (
          <EmptyState icon={TruckIcon} title="No challans" description="Track goods leaving your warehouse before invoicing." action={<button onClick={() => setShow(true)} className="btn-primary">New Challan</button>} />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Vehicle</th><th>Items</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.challanNumber}</td>
                    <td>{fmtDate(c.challanDate)}</td>
                    <td>{c.customer?.name}</td>
                    <td>{c.vehicleNumber || '—'}</td>
                    <td>{c._count?.items || 0}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-right space-x-2 text-sm">
                      {c.status === 'DRAFT' && <button onClick={() => action(c.id, 'Dispatch')} className="text-blue-600">Dispatch</button>}
                      {c.status === 'DISPATCHED' && <button onClick={() => action(c.id, 'Deliver')} className="text-green-600">Deliver</button>}
                      {c.status !== 'CANCELLED' && c.status !== 'DELIVERED' && <button onClick={() => action(c.id, 'Cancel')} className="text-red-600">Cancel</button>}
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
