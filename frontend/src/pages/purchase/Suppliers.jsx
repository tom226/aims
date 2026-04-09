import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtDate, getErrorMsg } from '../../components/utils';

const EMPTY_FORM = {
  name: '', code: '', contactPerson: '', email: '', phone: '',
  address: '', city: '', state: '', country: 'India',
  gstin: '', pan: '', paymentTerms: 30, status: 'ACTIVE',
};

function SupplierModal({ supplier, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: supplier || EMPTY_FORM,
  });

  async function onSubmit(data) {
    try {
      if (supplier?.id) {
        await api.put(`/suppliers/${supplier.id}`, data);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', data);
        toast.success('Supplier created');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-lg">{supplier?.id ? 'Edit' : 'New'} Supplier</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name *</label>
              <input className="input" {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="error-msg">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Supplier Code</label>
              <input className="input" placeholder="SUP-001" {...register('code')} />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" {...register('contactPerson')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...register('email')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" {...register('phone')} />
            </div>
            <div>
              <label className="label">Payment Terms (days)</label>
              <input type="number" className="input" {...register('paymentTerms', { valueAsNumber: true, min: 0 })} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" {...register('address')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">City</label>
              <input className="input" {...register('city')} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" {...register('state')} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" {...register('country')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">GSTIN</label>
              <input className="input" placeholder="22AAAAA0000A1Z5" {...register('gstin')} />
            </div>
            <div>
              <label className="label">PAN</label>
              <input className="input" placeholder="AAAPL1234C" {...register('pan')} />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" {...register('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLACKLISTED">Blacklisted</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'new' | supplier object

  const fetchSuppliers = useCallback(() => {
    setLoading(true);
    api.get('/suppliers', { params: { search: search || undefined, page, limit: 20 } })
      .then(r => { setSuppliers(r.data.data || []); setTotal(r.data.total || 0); })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  function handleSaved() {
    setModal(null);
    fetchSuppliers();
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total suppliers</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>
          <PlusIcon className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or code…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Code</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Payment Terms</th>
              <th>Status</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : suppliers.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                {search ? 'No suppliers match your search.' : 'No suppliers yet. Add your first supplier.'}
              </td></tr>
            ) : suppliers.map(s => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td className="text-gray-500">{s.code || '—'}</td>
                <td>{s.contactPerson || '—'}</td>
                <td className="text-gray-500">{s.email || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.paymentTerms} days</td>
                <td><StatusBadge status={s.status} /></td>
                <td className="text-gray-500">{fmtDate(s.createdAt)}</td>
                <td>
                  <button onClick={() => setModal(s)} className="text-gray-400 hover:text-primary-600 p-1">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                </td>
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

      {modal && (
        <SupplierModal
          supplier={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
