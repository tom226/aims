import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, PencilIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtDate, getErrorMsg } from '../../components/utils';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'SALESPERSON', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER', 'VIEWER'];

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user?.id;
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: user ? { name: user.name, email: user.email, role: user.role, isActive: user.isActive } : {
      name: '', email: '', password: '', role: 'VIEWER', isActive: true,
    },
  });

  async function onSubmit(data) {
    try {
      const payload = isEdit
        ? { name: data.name, role: data.role, isActive: data.isActive, ...(data.password ? { password: data.password } : {}) }
        : { name: data.name, email: data.email, password: data.password, role: data.role };
      if (isEdit) {
        await api.put(`/users/${user.id}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', payload);
        toast.success('User created');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">{isEdit ? 'Edit User' : 'New User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" {...register('name', { required: 'Name is required' })} />
            {errors.name && <p className="error-msg">{errors.name.message}</p>}
          </div>
          {!isEdit && (
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" {...register('email', { required: 'Email is required' })} />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>
          )}
          <div>
            <label className="label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" className="input" autoComplete="new-password"
              {...register('password', {
                required: !isEdit ? 'Password is required' : false,
                minLength: { value: 8, message: 'At least 8 characters' },
              })} />
            {errors.password && <p className="error-msg">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label">Role *</label>
            <select className="input" {...register('role', { required: true })}>
              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {isEdit && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" {...register('isActive')} className="w-4 h-4 rounded" />
              <label htmlFor="isActive" className="text-sm text-gray-700">Active account</label>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get('/users', { params: { search: search || undefined, page, limit: 20 } })
      .then(r => { setUsers(r.data.data || r.data || []); setTotal(r.data.total || r.data?.length || 0); })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function handleSaved() { setModal(null); fetchUsers(); }

  const roleColors = {
    SUPER_ADMIN: 'badge-red',
    PROCUREMENT_MANAGER: 'badge-blue',
    SALESPERSON: 'badge-green',
    WAREHOUSE_MANAGER: 'badge-amber',
    FINANCE_MANAGER: 'badge-purple',
    VIEWER: 'badge-gray',
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{total} users</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}>
          <PlusIcon className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or email…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Last Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={u.id === currentUser?.id ? 'bg-blue-50' : ''}>
                <td className="font-medium">{u.name}{u.id === currentUser?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}</td>
                <td className="text-gray-500">{u.email}</td>
                <td><span className={roleColors[u.role] || 'badge-gray'}>{u.role.replace(/_/g, ' ')}</span></td>
                <td><span className={u.isActive ? 'badge-green' : 'badge-red'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="text-gray-500">{fmtDate(u.createdAt)}</td>
                <td className="text-gray-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}</td>
                <td>
                  <button onClick={() => setModal(u)} className="text-gray-400 hover:text-primary-600 p-1">
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
        <UserModal
          user={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
