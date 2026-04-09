import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Stepper from '../../components/Stepper';
import { fmtCurrency, getErrorMsg } from '../../components/utils';

const STEPS = ['Select Customer', 'Add Products', 'Terms & Dates', 'Review & Confirm'];
const TAX_RATE = 0.18;

export default function CreateSO() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      customerId: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      paymentTerms: 30,
      shippingAddress: '',
      notes: '',
      items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, availableStock: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const watchedCustomerId = watch('customerId');

  useEffect(() => {
    api.get('/customers', { params: { limit: 200 } }).then(r => setCustomers(r.data.data || []));
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }).then(r => setProducts(r.data.data || []));
  }, []);

  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);

  const subTotal = watchedItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const taxAmount = subTotal * TAX_RATE;
  const grandTotal = subTotal + taxAmount;

  function handleProductChange(index, productId) {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setValue(`items.${index}.productId`, prod.id);
      setValue(`items.${index}.productName`, prod.name);
      setValue(`items.${index}.unitPrice`, prod.sellingPrice || prod.costPrice || 0);
      setValue(`items.${index}.availableStock`, prod.currentStock - (prod.reservedStock || 0));
    }
  }

  async function onSubmit(data) {
    setSubmitting(true);
    try {
      const payload = {
        customerId: data.customerId,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate || undefined,
        paymentTerms: Number(data.paymentTerms),
        shippingAddress: data.shippingAddress || undefined,
        notes: data.notes || undefined,
        items: data.items.map(it => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      };
      const res = await api.post('/sales-orders', payload);
      // Auto-confirm
      await api.patch(`/sales-orders/${res.data.id}/status`, { status: 'CONFIRMED' });
      toast.success(`SO ${res.data.soNumber} created & confirmed`);
      navigate('/sales/orders');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1>New Sales Order</h1>
          <p className="text-gray-500 text-sm mt-1">Create and confirm a customer order</p>
        </div>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0 — Customer */}
        {step === 0 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Select Customer</h2>
            <div>
              <label className="label">Customer *</label>
              <select className="input" {...register('customerId', { required: 'Select a customer' })}>
                <option value="">— Select Customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="error-msg">{errors.customerId.message}</p>}
            </div>

            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm grid grid-cols-3 gap-4">
                <div><span className="text-gray-500">Type</span><p className="font-medium">{selectedCustomer.customerType}</p></div>
                <div><span className="text-gray-500">Email</span><p className="font-medium">{selectedCustomer.email || '—'}</p></div>
                <div><span className="text-gray-500">Outstanding</span><p className="font-medium text-red-600">{fmtCurrency(selectedCustomer.outstandingBalance || 0)}</p></div>
              </div>
            )}

            <div>
              <label className="label">Shipping Address</label>
              <textarea className="input" rows={2} placeholder="Override default shipping address…" {...register('shippingAddress')} />
            </div>

            <div className="flex justify-end">
              <button type="button" disabled={!watchedCustomerId}
                className="btn-primary" onClick={() => setStep(1)}>
                Next: Add Products →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Products */}
        {step === 1 && (
          <div className="card card-body space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Add Products</h2>
              <button type="button" className="btn-secondary btn-sm"
                onClick={() => append({ productId: '', productName: '', quantity: 1, unitPrice: 0, availableStock: 0 })}>
                <PlusIcon className="w-4 h-4" /> Add Line
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, i) => {
                const item = watchedItems[i] || {};
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const isLowStock = item.availableStock > 0 && Number(item.quantity) > item.availableStock;
                const isOutOfStock = item.availableStock === 0 && Number(item.quantity) > 0;
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-5">
                        <label className="label">Product *</label>
                        <select className="input"
                          {...register(`items.${i}.productId`, { required: true })}
                          onChange={e => handleProductChange(i, e.target.value)}>
                          <option value="">— Select —</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Avail: {p.currentStock - (p.reservedStock || 0)})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="label">Quantity *</label>
                        <input type="number" min={1} className={`input ${isLowStock || isOutOfStock ? 'border-red-400' : ''}`}
                          {...register(`items.${i}.quantity`, { required: true, min: 1, valueAsNumber: true })} />
                        {isOutOfStock && <p className="error-msg">Out of stock</p>}
                        {isLowStock && <p className="error-msg">Exceeds available ({item.availableStock})</p>}
                      </div>
                      <div className="col-span-2">
                        <label className="label">Unit Price *</label>
                        <input type="number" min={0} step="0.01" className="input"
                          {...register(`items.${i}.unitPrice`, { required: true, min: 0, valueAsNumber: true })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Line Total</label>
                        <p className="input bg-gray-50 font-medium">{fmtCurrency(lineTotal)}</p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(i)} className="p-2 text-red-400 hover:text-red-600">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 max-w-xs ml-auto">
              <div className="flex justify-between"><span>Sub Total</span><span>{fmtCurrency(subTotal)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax (18%)</span><span>{fmtCurrency(taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total</span><span className="text-primary-700">{fmtCurrency(grandTotal)}</span></div>
            </div>

            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(2)}>Next: Terms →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Terms */}
        {step === 2 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Order Terms & Dates</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Order Date *</label>
                <input type="date" className="input" {...register('orderDate', { required: true })} />
              </div>
              <div>
                <label className="label">Expected Delivery Date</label>
                <input type="date" className="input" {...register('deliveryDate')} />
              </div>
              <div>
                <label className="label">Payment Terms (days)</label>
                <input type="number" min={0} className="input" {...register('paymentTerms', { valueAsNumber: true })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} placeholder="Special instructions, packaging notes…" {...register('notes')} />
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Review & Confirm Sales Order</h2>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
              <div><span className="text-gray-500">Customer</span><p className="font-medium">{selectedCustomer?.name}</p></div>
              <div><span className="text-gray-500">Order Date</span><p className="font-medium">{watch('orderDate')}</p></div>
              <div><span className="text-gray-500">Payment Terms</span><p className="font-medium">{watch('paymentTerms')} days</p></div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {watchedItems.map((it, i) => (
                    <tr key={i}>
                      <td>{it.productName || it.productId}</td>
                      <td className="text-right">{it.quantity}</td>
                      <td className="text-right">{fmtCurrency(it.unitPrice)}</td>
                      <td className="text-right">{fmtCurrency(it.quantity * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3} className="text-right">Sub Total</td><td className="text-right">{fmtCurrency(subTotal)}</td></tr>
                  <tr><td colSpan={3} className="text-right text-gray-500">Tax 18%</td><td className="text-right text-gray-500">{fmtCurrency(taxAmount)}</td></tr>
                  <tr><td colSpan={3} className="text-right font-bold">Grand Total</td><td className="text-right font-bold text-primary-700">{fmtCurrency(grandTotal)}</td></tr>
                </tfoot>
              </table>
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button type="submit" disabled={submitting} className="btn-success">
                {submitting ? 'Creating…' : 'Confirm Sales Order'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
