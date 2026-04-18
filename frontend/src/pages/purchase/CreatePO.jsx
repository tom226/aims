import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Stepper from '../../components/Stepper';
import { fmtCurrency, getErrorMsg } from '../../components/utils';

const STEPS = ['Select Supplier', 'Add Products', 'Set Terms', 'Review', 'Approve & Send'];

const NEW_SUPPLIER_DEFAULTS = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  gstin: '',
  billingAddress: '',
  shippingAddress: '',
  paymentTerms: 'Net 30',
  status: 'ACTIVE',
  notes: '',
};

function CreateSupplierModal({ onClose, onCreated }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: NEW_SUPPLIER_DEFAULTS });

  const submitSupplier = async (data) => {
    try {
      const { data: created } = await api.post('/suppliers', data);
      toast.success('Supplier created successfully');
      reset(NEW_SUPPLIER_DEFAULTS);
      onCreated(created);
    } catch (err) {
      toast.error(getErrorMsg(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Create Supplier</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit(submitSupplier)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name *</label>
              <input className={`input ${errors.name ? 'input-error' : ''}`} {...register('name', { required: 'Supplier name is required' })} />
              {errors.name && <p className="error-msg">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input className="input" {...register('contactPerson')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email')} />
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" {...register('phone')} />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input className="input" placeholder="22AAAAA0000A1Z5" {...register('gstin')} />
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <select className="input" {...register('paymentTerms')}>
                {['Net 7', 'Net 15', 'Net 30', 'Net 60', 'Immediate', 'Custom'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Billing Address</label>
            <textarea rows={2} className="input" {...register('billingAddress')} />
          </div>
          <div>
            <label className="label">Shipping Address</label>
            <textarea rows={2} className="input" {...register('shippingAddress')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="input" {...register('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Creating…' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreatePO() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const { register, control, watch, setValue, getValues, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      supplierId: '',
      items: [{ productId: '', quantityOrdered: 1, unitPrice: '', taxRate: 18, description: '', notes: '' }],
      expectedDeliveryDate: '',
      deliveryLocation: '',
      paymentTerms: 'Net 30',
      shippingTerms: 'FOB',
      additionalCharges: 0,
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const supplierId = watch('supplierId');

  const fetchSuppliers = async (selectedId) => {
    const { data } = await api.get('/suppliers', { params: { limit: 100, status: 'ACTIVE' } });
    const nextSuppliers = data.data || [];
    setSuppliers(nextSuppliers);
    if (selectedId) setValue('supplierId', selectedId);
  };

  useEffect(() => {
    fetchSuppliers();
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }).then(r => setProducts(r.data.data || []));
  }, []);

  const selectedSupplier = suppliers.find(s => s.id === supplierId);

  // Auto-fill payment terms from supplier
  useEffect(() => {
    if (selectedSupplier) setValue('paymentTerms', selectedSupplier.paymentTerms);
  }, [supplierId]);

  const getProductById = (id) => products.find(p => p.id === id);

  const calcTotals = () => {
    let subTotal = 0, taxAmount = 0;
    items.forEach(item => {
      const qty = parseFloat(item.quantityOrdered) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const tax = parseFloat(item.taxRate) || 0;
      const lineTotal = qty * price;
      const lineTax = lineTotal * (tax / 100);
      subTotal += lineTotal;
      taxAmount += lineTax;
    });
    const additionalCharges = parseFloat(getValues('additionalCharges')) || 0;
    return { subTotal, taxAmount, grandTotal: subTotal + taxAmount + additionalCharges };
  };

  const next = () => {
    if (step === 1 && !supplierId) { toast.error('Please select a supplier.'); return; }
    if (step === 2 && items.some(i => !i.productId || !i.quantityOrdered || !i.unitPrice)) {
      toast.error('Please fill all product details.'); return;
    }
    setStep(s => Math.min(s + 1, 5));
  };

  const back = () => setStep(s => Math.max(s - 1, 1));

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = { ...data, items: data.items.map(i => ({ ...i, quantityOrdered: parseFloat(i.quantityOrdered), unitPrice: parseFloat(i.unitPrice), taxRate: parseFloat(i.taxRate || 0) })) };
      const res = await api.post('/purchase-orders', payload);
      // Auto-approve and send
      await api.patch(`/purchase-orders/${res.data.id}/status`, { status: 'APPROVED' });
      toast.success(`Purchase Order ${res.data.poNumber} created successfully!`);
      navigate(`/purchase/orders/${res.data.id}`);
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const { subTotal, taxAmount, grandTotal } = calcTotals();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm">
          <ChevronLeftIcon className="w-4 h-4" /> Back
        </button>
        <h1>Create Purchase Order</h1>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Select Supplier */}
        {step === 1 && (
          <div className="card card-body space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2>Step 1: Select Supplier</h2>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowSupplierModal(true)}>
                <PlusIcon className="w-4 h-4" /> Create Supplier
              </button>
            </div>
            <div>
              <label className="label">Supplier *</label>
              <select className={`input ${errors.supplierId ? 'input-error' : ''}`} {...register('supplierId', { required: true })}>
                <option value="">— Select Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} {s.gstin ? `(${s.gstin})` : ''}</option>)}
              </select>
            </div>
            {selectedSupplier && (
              <div className="bg-blue-50 rounded-lg p-4 text-sm space-y-1">
                <p><span className="font-semibold">Contact:</span> {selectedSupplier.contactPerson || '—'}</p>
                <p><span className="font-semibold">Payment Terms:</span> {selectedSupplier.paymentTerms}</p>
                <p><span className="font-semibold">Address:</span> {selectedSupplier.billingAddress || '—'}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Add Products */}
        {step === 2 && (
          <div className="card card-body space-y-4">
            <h2>Step 2: Add Products</h2>
            <div className="space-y-3">
              {fields.map((field, index) => {
                const product = getProductById(items[index]?.productId);
                return (
                  <div key={field.id} className="p-4 border border-gray-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="label">Product *</label>
                        <select className="input" {...register(`items.${index}.productId`, { required: true })}>
                          <option value="">— Select Product —</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                        </select>
                        {product && (
                          <p className="text-xs text-gray-400 mt-1">
                            Stock: <span className={parseFloat(product.currentStock) <= parseFloat(product.reorderLevel) ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>{product.currentStock} {product.unit}</span>
                            &nbsp;| Reorder: {product.reorderLevel}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="label">Qty *</label>
                        <input type="number" min="0.001" step="0.001" className="input" {...register(`items.${index}.quantityOrdered`, { required: true, min: 0.001 })} />
                      </div>
                      <div>
                        <label className="label">Unit Price *</label>
                        <input type="number" min="0" step="0.01" className="input" placeholder="₹" {...register(`items.${index}.unitPrice`, { required: true, min: 0 })} />
                      </div>
                      <div>
                        <label className="label">Tax Rate %</label>
                        <select className="input" {...register(`items.${index}.taxRate`)}>
                          <option value="0">0% (Exempt)</option>
                          <option value="5">5% (GST)</option>
                          <option value="12">12% (GST)</option>
                          <option value="18">18% (GST)</option>
                          <option value="28">28% (GST)</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Line Total</label>
                        <input readOnly className="input bg-gray-50" value={fmtCurrency((parseFloat(items[index]?.quantityOrdered) || 0) * (parseFloat(items[index]?.unitPrice) || 0))} />
                      </div>
                      <div className="flex items-end">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="btn-danger btn-sm w-full">
                            <TrashIcon className="w-4 h-4" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Description row */}
                    <div>
                      <label className="label">Description / Particulars</label>
                      <input type="text" className="input" placeholder="e.g. Monthly Maintenance Charges Of Edge1 OOH Software" {...register(`items.${index}.description`)} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => append({ productId: '', quantityOrdered: 1, unitPrice: '', taxRate: 18, description: '', notes: '' })}
              className="btn-secondary btn-sm"
            >
              <PlusIcon className="w-4 h-4" /> Add Line Item
            </button>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <div className="flex justify-between"><span>Sub Total:</span><span>{fmtCurrency(subTotal)}</span></div>
              <div className="flex justify-between"><span>Tax:</span><span>{fmtCurrency(taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2"><span>Grand Total:</span><span>{fmtCurrency(grandTotal)}</span></div>
            </div>
          </div>
        )}

        {/* Step 3: Terms */}
        {step === 3 && (
          <div className="card card-body space-y-4">
            <h2>Step 3: Set Terms & Dates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Expected Delivery Date *</label>
                <input type="date" className="input" {...register('expectedDeliveryDate', { required: true })} />
              </div>
              <div>
                <label className="label">Delivery Location</label>
                <input type="text" className="input" placeholder="Warehouse / Address" {...register('deliveryLocation')} />
              </div>
              <div>
                <label className="label">Payment Terms</label>
                <select className="input" {...register('paymentTerms')}>
                  {['Net 7', 'Net 15', 'Net 30', 'Net 60', 'Immediate', 'Custom'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Shipping Terms</label>
                <select className="input" {...register('shippingTerms')}>
                  {['FOB', 'CIF', 'Ex-Works', 'DDP', 'DAP'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Transportation Charges (₹)</label>
                <input type="number" min="0" className="input" {...register('additionalCharges')} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} placeholder="Internal notes…" {...register('notes')} />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="card card-body space-y-4">
            <h2>Step 4: Review Purchase Order</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-gray-500">Supplier</p>
                <p className="font-semibold">{selectedSupplier?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">Expected Delivery</p>
                <p className="font-semibold">{getValues('expectedDeliveryDate') || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">Payment Terms</p>
                <p className="font-semibold">{getValues('paymentTerms')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">Shipping Terms</p>
                <p className="font-semibold">{getValues('shippingTerms')}</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Total</th></tr></thead>
                <tbody>
                  {items.map((item, i) => {
                    const product = getProductById(item.productId);
                    const lineTotal = (parseFloat(item.quantityOrdered) || 0) * (parseFloat(item.unitPrice) || 0);
                    const lineTax = lineTotal * ((parseFloat(item.taxRate) || 0) / 100);
                    return (
                      <tr key={i}>
                        <td className="font-medium">{product?.name || '—'}</td>
                        <td>{item.quantityOrdered} {product?.unit}</td>
                        <td>{fmtCurrency(item.unitPrice)}</td>
                        <td>{item.taxRate}%</td>
                        <td className="font-semibold">{fmtCurrency(lineTotal + lineTax)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 ml-auto max-w-xs">
              <div className="flex justify-between"><span>Sub Total:</span><span>{fmtCurrency(subTotal)}</span></div>
              <div className="flex justify-between"><span>Tax:</span><span>{fmtCurrency(taxAmount)}</span></div>
              <div className="flex justify-between"><span>Transportation Charges:</span><span>{fmtCurrency(getValues('additionalCharges'))}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total:</span><span>{fmtCurrency(grandTotal)}</span></div>
            </div>
          </div>
        )}

        {/* Step 5: Approve & Send */}
        {step === 5 && (
          <div className="card card-body space-y-4 text-center">
            <h2>Step 5: Approve & Send</h2>
            <p className="text-gray-600">Review the details above. Confirming will generate a PO number, approve the order, and mark it as sent to the supplier.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              Grand Total: <span className="font-bold text-lg">{fmtCurrency(grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-4">
          <button type="button" onClick={back} disabled={step === 1} className="btn-secondary">
            <ChevronLeftIcon className="w-4 h-4" /> Previous
          </button>
          {step < 5 ? (
            <button type="button" onClick={next} className="btn-primary">
              Next <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button type="submit" className="btn-success" disabled={loading}>
              {loading ? 'Creating…' : '✓ Create & Approve PO'}
            </button>
          )}
        </div>
      </form>

      {showSupplierModal && (
        <CreateSupplierModal
          onClose={() => setShowSupplierModal(false)}
          onCreated={(newSupplier) => {
            setShowSupplierModal(false);
            fetchSuppliers(newSupplier.id);
          }}
        />
      )}
    </div>
  );
}
