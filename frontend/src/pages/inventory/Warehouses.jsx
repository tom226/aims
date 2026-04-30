import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, PencilIcon, TrashIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { getErrorMsg } from '../../components/utils';
import EmptyState from '../../components/EmptyState';

const EMPTY = { name: '', code: '', address: '', city: '', state: '', isDefault: false, isActive: true };

function WarehouseModal({ warehouse, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: warehouse || EMPTY,
  });

  async function onSubmit(data) {
    try {
      if (warehouse?.id) {
        await api.put(`/warehouses/${warehouse.id}`, data);
        toast.success('Warehouse updated');
      } else {
        await api.post('/warehouses', data);
        toast.success('Warehouse created');
      }
      onSaved();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-lg dark:text-white">{warehouse?.id ? 'Edit' : 'New'} Warehouse</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" {...register('name', { required: 'Required' })} />
              {errors.name && <p className="error-msg">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Code</label>
              <input className="input" placeholder="WH-001" {...register('code')} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" {...register('address')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input className="input" {...register('city')} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" {...register('state')} />
            </div>
          </div>
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 dark:text-gray-200">
              <input type="checkbox" {...register('isDefault')} /> Set as default
            </label>
            <label className="flex items-center gap-2 dark:text-gray-200">
              <input type="checkbox" {...register('isActive')} /> Active
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Warehouses() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/warehouses');
      setList(data);
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    if (!confirm('Delete this warehouse?')) return;
    try {
      await api.delete(`/warehouses/${id}`);
      toast.success('Deleted');
      load();
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold dark:text-white">Warehouses</h1>
        <button onClick={() => { setEditing(null); setShow(true); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> New Warehouse
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : list.length === 0 ? (
          <EmptyState icon={BuildingStorefrontIcon} title="No warehouses" description="Create your first warehouse to start managing multi-location stock." action={
            <button onClick={() => setShow(true)} className="btn-primary">Create Warehouse</button>
          } />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead><tr>
                <th>Name</th><th>Code</th><th>City</th><th>State</th><th>Default</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {list.map(w => (
                  <tr key={w.id}>
                    <td className="font-medium">{w.name}</td>
                    <td>{w.code || '—'}</td>
                    <td>{w.city || '—'}</td>
                    <td>{w.state || '—'}</td>
                    <td>{w.isDefault && <span className="badge-success">Default</span>}</td>
                    <td>{w.isActive ? <span className="badge-success">Active</span> : <span className="badge-danger">Inactive</span>}</td>
                    <td className="text-right">
                      <button onClick={() => { setEditing(w); setShow(true); }} className="text-blue-600 hover:text-blue-800 mr-3"><PencilIcon className="w-4 h-4" /></button>
                      <button onClick={() => remove(w.id)} className="text-red-600 hover:text-red-800"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {show && <WarehouseModal warehouse={editing} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}
