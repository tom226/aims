import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { PlusIcon, PencilIcon, MagnifyingGlassIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtQty, fmtDate, getErrorMsg } from '../../components/utils';
import { useAuth } from '../../context/AuthContext';
import { exportToCsv, parseCsv } from '../../lib/csv';

const EMPTY_FORM = {
  name: '', sku: '', description: '', categoryId: '', supplierId: '',
  unit: 'PCS', costPrice: 0, sellingPrice: 0, taxRate: 18,
  reorderPoint: 10, reorderQty: 50, currentStock: 0, status: 'ACTIVE',
  brand: '', imageUrl: '', barcode: '', hsnCode: '',
  weight: '', weightUnit: 'kg', length: '', width: '', height: '',
};

function ProductModal({ product, categories, suppliers, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: product ? {
      ...product,
      categoryId: product.category?.id || '',
      supplierId: product.supplier?.id || '',
    } : EMPTY_FORM,
  });

  async function onSubmit(data) {
    try {
      const payload = { ...data, categoryId: data.categoryId || undefined, supplierId: data.supplierId || undefined };
      if (product?.id) {
        await api.put(`/products/${product.id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">{product?.id ? 'Edit' : 'New'} Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product Name *</label>
              <input className="input" {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="error-msg">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input" placeholder="SKU-001" {...register('sku')} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" {...register('categoryId')}>
                <option value="">— None —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Preferred Supplier</label>
              <select className="input" {...register('supplierId')}>
                <option value="">— None —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <input className="input" placeholder="PCS / KG / LTR" {...register('unit')} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" {...register('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </div>
            <div>
              <label className="label">Cost Price</label>
              <input type="number" min={0} step="0.01" className="input" {...register('costPrice', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Selling Price</label>
              <input type="number" min={0} step="0.01" className="input" {...register('sellingPrice', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Reorder Point</label>
              <input type="number" min={0} className="input" {...register('reorderPoint', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Reorder Quantity</label>
              <input type="number" min={0} className="input" {...register('reorderQty', { valueAsNumber: true })} />
            </div>
            {!product?.id && (
              <div>
                <label className="label">Opening Stock</label>
                <input type="number" min={0} className="input" {...register('currentStock', { valueAsNumber: true })} />
              </div>
            )}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={2} {...register('description')} />
          </div>
          <details className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-sm dark:text-gray-200">Additional details (brand, dimensions, tax)</summary>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div><label className="label">Brand</label><input className="input" {...register('brand')} /></div>
              <div><label className="label">HSN Code</label><input className="input" {...register('hsnCode')} /></div>
              <div><label className="label">Barcode</label><input className="input" {...register('barcode')} /></div>
              <div><label className="label">Tax Rate (%)</label><input type="number" min="0" step="0.01" className="input" {...register('taxRate', { valueAsNumber: true })} /></div>
              <div><label className="label">Image URL</label><input className="input" {...register('imageUrl')} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label">Weight</label><input type="number" step="0.01" className="input" {...register('weight')} /></div>
                <div><label className="label">Unit</label>
                  <select className="input" {...register('weightUnit')}>
                    <option value="kg">kg</option><option value="g">g</option><option value="lb">lb</option><option value="oz">oz</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 col-span-2">
                <div><label className="label">Length (cm)</label><input type="number" step="0.01" className="input" {...register('length')} /></div>
                <div><label className="label">Width (cm)</label><input type="number" step="0.01" className="input" {...register('width')} /></div>
                <div><label className="label">Height (cm)</label><input type="number" step="0.01" className="input" {...register('height')} /></div>
              </div>
            </div>
          </details>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Saving…' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Products() {
  const { hasRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const fileInputRef = useRef(null);

  async function handleExport() {
    try {
      const { data } = await api.get('/products', { params: { limit: 5000 } });
      const rows = (data.data || []).map(p => ({
        sku: p.sku, name: p.name, description: p.description || '',
        categoryName: p.category?.name || '', unit: p.unit, hsnCode: p.hsnCode || '',
        taxRate: p.taxRate, costPrice: p.costPrice, sellingPrice: p.sellingPrice,
        reorderLevel: p.reorderLevel ?? p.reorderPoint, reorderQuantity: p.reorderQuantity ?? p.reorderQty,
        brand: p.brand || '', barcode: p.barcode || '', currentStock: p.currentStock,
      }));
      exportToCsv(`products-${new Date().toISOString().slice(0,10)}.csv`, rows);
      toast.success(`Exported ${rows.length} products`);
    } catch (err) { toast.error(getErrorMsg(err)); }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast.error('Empty CSV'); return; }
      if (!confirm(`Import ${rows.length} products? Existing SKUs will be updated.`)) return;
      const { data } = await api.post('/products/bulk-import', { rows });
      toast.success(`Created ${data.created}, Updated ${data.updated}, Skipped ${data.skipped}`);
      if (data.errors?.length) console.warn('Import errors:', data.errors);
      fetchProducts();
    } catch (err) { toast.error(getErrorMsg(err)); }
    finally { e.target.value = ''; }
  }

  const fetchProducts = useCallback(() => {
    setLoading(true);
    api.get('/products', { params: { search: search || undefined, categoryId: categoryId || undefined, page, limit: 20 } })
      .then(r => { setProducts(r.data.data || []); setTotal(r.data.total || 0); })
      .finally(() => setLoading(false));
  }, [search, categoryId, page]);

  useEffect(() => {
    fetchProducts();
    api.get('/categories', { params: { limit: 100 } }).then(r => setCategories(r.data.data || r.data || []));
    api.get('/suppliers', { params: { limit: 100 } }).then(r => setSuppliers(r.data.data || []));
  }, [fetchProducts]);

  function handleSaved() { setModal(null); fetchProducts(); }

  function stockClass(product) {
    const avail = product.currentStock - (product.reservedStock || 0);
    if (avail <= 0) return 'text-red-600 font-bold';
    if (avail <= product.reorderPoint) return 'text-amber-500 font-semibold';
    return 'text-green-600';
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total products</p>
        </div>
        {hasRole('PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN') && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={handleExport}>
              <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
            </button>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <ArrowUpTrayIcon className="w-4 h-4" /> Import CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <button className="btn-primary" onClick={() => setModal('new')}>
              <PlusIcon className="w-4 h-4" /> Add Product
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or SKU…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-44" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Selling</th>
              <th className="text-right">In Stock</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Available</th>
              <th className="text-right">Reorder Pt.</th>
              <th>Status</th>
              {hasRole('PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN') && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">No products found.</td></tr>
            ) : products.map(p => {
              const avail = p.currentStock - (p.reservedStock || 0);
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-gray-500">{p.sku || '—'}</td>
                  <td className="text-gray-500">{p.category?.name || '—'}</td>
                  <td className="text-right">{fmtCurrency(p.costPrice)}</td>
                  <td className="text-right">{fmtCurrency(p.sellingPrice || 0)}</td>
                  <td className="text-right">{fmtQty(p.currentStock, p.unit)}</td>
                  <td className="text-right text-gray-500">{p.reservedStock || 0}</td>
                  <td className={`text-right ${stockClass(p)}`}>{fmtQty(avail, p.unit)}</td>
                  <td className="text-right text-gray-500">{p.reorderPoint}</td>
                  <td><StatusBadge status={p.status} /></td>
                  {hasRole('PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER', 'SUPER_ADMIN') && (
                    <td>
                      <button onClick={() => setModal(p)} className="text-gray-400 hover:text-primary-600 p-1">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
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
        <ProductModal
          product={modal === 'new' ? null : modal}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
