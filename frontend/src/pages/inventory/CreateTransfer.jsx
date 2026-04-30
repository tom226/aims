import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { getErrorMsg } from '../../components/utils';

export default function CreateTransfer() {
  const nav = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/warehouses').then(({ data }) => setWarehouses(data));
    api.get('/products?limit=500').then(({ data }) => setProducts(data.data || data));
  }, []);

  function addItem() { setItems([...items, { productId: '', quantity: 1 }]); }
  function updateItem(i, key, val) {
    const next = [...items]; next[i] = { ...next[i], [key]: val }; setItems(next);
  }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!from || !to) return toast.error('Select both warehouses');
    if (from === to) return toast.error('From and To must differ');
    const valid = items.filter(it => it.productId && parseFloat(it.quantity) > 0);
    if (valid.length === 0) return toast.error('Add at least one item');

    setSaving(true);
    try {
      await api.post('/stock-transfers', {
        fromWarehouseId: from, toWarehouseId: to, transferDate: date, reason, notes,
        items: valid.map(it => ({ productId: it.productId, quantity: parseFloat(it.quantity) })),
      });
      toast.success('Transfer created');
      nav('/inventory/transfers');
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-semibold dark:text-white">New Stock Transfer</h1>
      <div className="card p-6 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">From Warehouse *</label>
            <select className="input" value={from} onChange={e => setFrom(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To Warehouse *</label>
            <select className="input" value={to} onChange={e => setTo(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.filter(w => w.id !== from).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Transfer Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Reason</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold dark:text-white">Items</h2>
          <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-sm">
            <PlusIcon className="w-4 h-4" /> Add Item
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b dark:border-gray-700"><th className="py-2">Product</th><th>Qty</th><th></th></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b dark:border-gray-700">
                <td className="py-2 pr-2">
                  <select className="input" value={it.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </td>
                <td className="pr-2 w-32">
                  <input type="number" min="0.001" step="0.001" className="input" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                </td>
                <td className="w-12 text-right">
                  <button onClick={() => removeItem(i)} className="text-red-600"><TrashIcon className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => nav(-1)} className="btn-secondary">Cancel</button>
        <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Create Transfer'}</button>
      </div>
    </div>
  );
}
