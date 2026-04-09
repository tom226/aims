import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Stepper from '../../components/Stepper';
import { fmtCurrency, getErrorMsg } from '../../components/utils';

const STEPS = ['Invoice Type', 'Customer & Source', 'Line Items', 'Terms & Dates', 'Review & Issue'];
const TAX_RATE = 0.18;

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [invoiceMode, setInvoiceMode] = useState('FRESH'); // FRESH | FROM_SO | FROM_PO
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      customerId: searchParams.get('customerId') || '',
      salesOrderId: searchParams.get('soId') || '',
      purchaseOrderId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      paymentTerms: 30,
      notes: '',
      items: [{ productId: '', productName: '', quantity: 1, unitPrice: 0, costPrice: 0 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  const watchedCustomerId = watch('customerId');
  const watchedPOId = watch('purchaseOrderId');
  const watchedSOId = watch('salesOrderId');

  const selectedCustomer = customers.find(c => c.id === watchedCustomerId);

  const subTotal = watchedItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const taxAmount = subTotal * TAX_RATE;
  const grandTotal = subTotal + taxAmount;
  const totalCost = watchedItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.costPrice) || 0), 0);
  const margin = grandTotal > 0 ? ((grandTotal - totalCost) / grandTotal) * 100 : 0;

  useEffect(() => {
    api.get('/customers', { params: { limit: 200 } }).then(r => setCustomers(r.data.data || []));
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }).then(r => setProducts(r.data.data || []));
    api.get('/sales-orders', { params: { status: 'CONFIRMED,PARTIALLY_DELIVERED', limit: 100 } }).then(r => setSalesOrders(r.data.data || []));
    api.get('/purchase-orders', { params: { status: 'FULLY_RECEIVED,PARTIALLY_RECEIVED', limit: 100 } }).then(r => setPurchaseOrders(r.data.data || []));
  }, []);

  // Mode B: load PO items when PO selected
  useEffect(() => {
    if (invoiceMode !== 'FROM_PO' || !watchedPOId) return;
    api.get(`/purchase-orders/${watchedPOId}`).then(r => {
      const po = r.data;
      setSelectedPO(po);
      if (po.customer?.id) setValue('customerId', po.customer.id);
      replace(po.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.product.sellingPrice || item.unitPrice,
        costPrice: item.unitPrice,
      })));
    });
  }, [watchedPOId, invoiceMode, replace, setValue]);

  // FROM_SO: load SO items
  useEffect(() => {
    if (invoiceMode !== 'FROM_SO' || !watchedSOId) return;
    api.get(`/sales-orders/${watchedSOId}`).then(r => {
      const so = r.data;
      setValue('customerId', so.customerId);
      replace(so.items.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.product.costPrice || 0,
      })));
    });
  }, [watchedSOId, invoiceMode, replace, setValue]);

  function handleProductChange(index, productId) {
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setValue(`items.${index}.productName`, prod.name);
      setValue(`items.${index}.unitPrice`, prod.sellingPrice || prod.costPrice || 0);
      setValue(`items.${index}.costPrice`, prod.costPrice || 0);
    }
  }

  async function onSubmit(data) {
    setSubmitting(true);
    try {
      const payload = {
        customerId: data.customerId,
        salesOrderId: invoiceMode === 'FROM_SO' ? data.salesOrderId : undefined,
        purchaseOrderId: invoiceMode === 'FROM_PO' ? data.purchaseOrderId : undefined,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate || undefined,
        paymentTerms: Number(data.paymentTerms),
        notes: data.notes || undefined,
        items: data.items.map(it => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
        })),
      };
      const res = await api.post('/invoices', payload);
      toast.success(`Invoice ${res.data.invoiceNumber} issued`);
      navigate(`/sales/invoices/${res.data.id}`);
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
          <h1>New Invoice</h1>
          <p className="text-gray-500 text-sm mt-1">Create and issue a sales invoice</p>
        </div>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0 — Invoice Type */}
        {step === 0 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Invoice Type</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'FRESH', label: 'Fresh Invoice', desc: 'Create invoice directly without a linked order' },
                { id: 'FROM_SO', label: 'From Sales Order', desc: 'Generate invoice from a confirmed sales order' },
                { id: 'FROM_PO', label: 'Against PO (Mode B)', desc: 'Invoice against a received purchase order for re-billing' },
              ].map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => setInvoiceMode(opt.id)}
                  className={`border-2 rounded-xl p-5 text-left transition-all ${invoiceMode === opt.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className="font-semibold text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
            {invoiceMode === 'FROM_PO' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <strong>Mode B:</strong> Invoice will use purchase prices as cost basis. You can adjust selling prices in the next step to show margin.
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setStep(1)}>
                Next: Customer & Source →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Customer & Source */}
        {step === 1 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Customer & Source Document</h2>
            <div>
              <label className="label">Customer *</label>
              <select className="input" {...register('customerId', { required: 'Select a customer' })}>
                <option value="">— Select Customer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.customerId && <p className="error-msg">{errors.customerId.message}</p>}
            </div>

            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm flex gap-6">
                <div><span className="text-gray-500">Type: </span><span className="font-medium">{selectedCustomer.customerType}</span></div>
                <div><span className="text-gray-500">Outstanding: </span><span className="font-medium text-red-600">{fmtCurrency(selectedCustomer.outstandingBalance || 0)}</span></div>
              </div>
            )}

            {invoiceMode === 'FROM_SO' && (
              <div>
                <label className="label">Sales Order *</label>
                <select className="input" {...register('salesOrderId', { required: invoiceMode === 'FROM_SO' })}>
                  <option value="">— Select SO —</option>
                  {salesOrders.map(so => <option key={so.id} value={so.id}>{so.soNumber} – {so.customer?.name}</option>)}
                </select>
              </div>
            )}

            {invoiceMode === 'FROM_PO' && (
              <div>
                <label className="label">Purchase Order (received) *</label>
                <select className="input" {...register('purchaseOrderId', { required: invoiceMode === 'FROM_PO' })}>
                  <option value="">— Select PO —</option>
                  {purchaseOrders.map(po => <option key={po.id} value={po.id}>{po.poNumber} – {po.supplier?.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button type="button" className="btn-primary" disabled={!watchedCustomerId} onClick={() => setStep(2)}>
                Next: Line Items →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Line Items */}
        {step === 2 && (
          <div className="card card-body space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Line Items</h2>
              {invoiceMode === 'FRESH' && (
                <button type="button" className="btn-secondary btn-sm"
                  onClick={() => append({ productId: '', productName: '', quantity: 1, unitPrice: 0, costPrice: 0 })}>
                  <PlusIcon className="w-4 h-4" /> Add Line
                </button>
              )}
            </div>

            <div className="space-y-3">
              {fields.map((field, i) => {
                const item = watchedItems[i] || {};
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
                const lineCost = (Number(item.quantity) || 0) * (Number(item.costPrice) || 0);
                const lineMargin = lineTotal > 0 ? ((lineTotal - lineCost) / lineTotal) * 100 : 0;
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-4">
                        <label className="label">Product *</label>
                        {invoiceMode === 'FRESH' ? (
                          <select className="input"
                            {...register(`items.${i}.productId`, { required: true })}
                            onChange={e => handleProductChange(i, e.target.value)}>
                            <option value="">— Select —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        ) : (
                          <p className="input bg-gray-50">{item.productName}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="label">Qty</label>
                        <input type="number" min={1} className="input"
                          {...register(`items.${i}.quantity`, { required: true, min: 1, valueAsNumber: true })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Selling Price</label>
                        <input type="number" min={0} step="0.01" className="input"
                          {...register(`items.${i}.unitPrice`, { required: true, min: 0, valueAsNumber: true })} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Line Total</label>
                        <p className="input bg-gray-50 font-medium">{fmtCurrency(lineTotal)}</p>
                      </div>
                      <div className="col-span-1">
                        <label className="label">Margin</label>
                        <p className={`text-sm font-medium ${lineMargin >= 20 ? 'text-green-600' : lineMargin >= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                          {lineMargin.toFixed(1)}%
                        </p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {invoiceMode === 'FRESH' && fields.length > 1 && (
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
              <div className={`flex justify-between font-medium ${margin >= 20 ? 'text-green-600' : 'text-amber-600'}`}>
                <span>Overall Margin</span><span>{margin.toFixed(1)}%</span>
              </div>
            </div>

            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)}>Next: Terms →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Terms */}
        {step === 3 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Invoice Terms & Dates</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Invoice Date *</label>
                <input type="date" className="input" {...register('invoiceDate', { required: true })} />
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" {...register('dueDate')} />
              </div>
              <div>
                <label className="label">Payment Terms (days)</label>
                <input type="number" min={0} className="input" {...register('paymentTerms', { valueAsNumber: true })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} placeholder="Payment instructions, bank details…" {...register('notes')} />
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(4)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Review & Issue Invoice</h2>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
              <div><span className="text-gray-500">Customer</span><p className="font-medium">{selectedCustomer?.name}</p></div>
              <div><span className="text-gray-500">Invoice Date</span><p className="font-medium">{watch('invoiceDate')}</p></div>
              <div><span className="text-gray-500">Due Date</span><p className="font-medium">{watch('dueDate') || 'N/A'}</p></div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Total</th>
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Issuing this invoice will deduct stock. Ensure all quantities are correct before proceeding.
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <button type="submit" disabled={submitting} className="btn-success">
                {submitting ? 'Issuing…' : 'Issue Invoice'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
