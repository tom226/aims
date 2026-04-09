import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Stepper from '../../components/Stepper';
import { fmtCurrency, fmtDate, getErrorMsg } from '../../components/utils';

const STEPS = ['Select PO', 'Receive Items', 'Notes & Quality', 'Confirm'];

export default function CreateGRN() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [openPOs, setOpenPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      purchaseOrderId: searchParams.get('poId') || '',
      receivedDate: new Date().toISOString().split('T')[0],
      supplierInvoiceNumber: '',
      notes: '',
      items: [],
    },
  });

  const { fields } = useFieldArray({ control, name: 'items' });
  const watchedPOId = watch('purchaseOrderId');

  useEffect(() => {
    api.get('/purchase-orders', { params: { status: 'APPROVED,SENT,PARTIALLY_RECEIVED', limit: 100 } })
      .then(r => setOpenPOs(r.data.data || []));
  }, []);

  useEffect(() => {
    if (!watchedPOId) { setSelectedPO(null); return; }
    api.get(`/purchase-orders/${watchedPOId}`).then(r => {
      const po = r.data;
      setSelectedPO(po);
      const items = po.items.map(item => ({
        poItemId: item.id,
        productId: item.product.id,
        productName: item.product.name,
        orderedQty: item.quantity,
        receivedQty: item.receivedQty || 0,
        pendingQty: item.quantity - (item.receivedQty || 0),
        receivingQty: item.quantity - (item.receivedQty || 0),
        unitCost: item.unitPrice,
        qualityStatus: 'ACCEPTED',
        rejectedQty: 0,
        qualityNotes: '',
      }));
      setValue('items', items);
    });
  }, [watchedPOId, setValue]);

  const watchedItems = watch('items');

  const totalValue = watchedItems.reduce((sum, item) => {
    const qty = Number(item.receivingQty) || 0;
    return sum + qty * Number(item.unitCost);
  }, 0);

  async function onSubmit(data) {
    setSubmitting(true);
    try {
      const payload = {
        purchaseOrderId: data.purchaseOrderId,
        receivedDate: data.receivedDate,
        supplierInvoiceNumber: data.supplierInvoiceNumber || undefined,
        notes: data.notes || undefined,
        items: data.items.map(item => ({
          purchaseOrderItemId: item.poItemId,
          productId: item.productId,
          quantityReceived: Number(item.receivingQty),
          quantityRejected: Number(item.rejectedQty) || 0,
          unitCost: Number(item.unitCost),
          qualityStatus: item.qualityStatus,
          qualityNotes: item.qualityNotes || undefined,
        })),
      };
      const res = await api.post('/grn', payload);
      toast.success(`GRN ${res.data.grnNumber} created`);
      navigate('/purchase/grn');
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
          <h1>Receive Goods</h1>
          <p className="text-gray-500 text-sm mt-1">Record goods receipt against a Purchase Order</p>
        </div>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0 – Select PO */}
        {step === 0 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Select Purchase Order</h2>
            <div>
              <label className="label">Purchase Order *</label>
              <select className="input" {...register('purchaseOrderId', { required: 'Select a PO' })}>
                <option value="">— Select PO —</option>
                {openPOs.map(po => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} – {po.supplier?.name} ({fmtDate(po.createdAt)})
                  </option>
                ))}
              </select>
              {errors.purchaseOrderId && <p className="error-msg">{errors.purchaseOrderId.message}</p>}
            </div>

            {selectedPO && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div><span className="text-gray-500">Supplier</span><p className="font-medium">{selectedPO.supplier?.name}</p></div>
                  <div><span className="text-gray-500">Order Date</span><p className="font-medium">{fmtDate(selectedPO.orderDate)}</p></div>
                  <div><span className="text-gray-500">Grand Total</span><p className="font-medium">{fmtCurrency(selectedPO.grandTotal)}</p></div>
                </div>
                <div className="mt-2">
                  <span className="text-gray-500">Line Items: </span>
                  <span className="font-medium">{selectedPO.items?.length} products</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Received Date *</label>
                <input type="date" className="input" {...register('receivedDate', { required: true })} />
              </div>
              <div>
                <label className="label">Supplier Invoice No.</label>
                <input className="input" placeholder="INV-2026-001" {...register('supplierInvoiceNumber')} />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" disabled={!watchedPOId || !selectedPO}
                className="btn-primary" onClick={() => setStep(1)}>
                Next: Receive Items →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 – Enter Quantities */}
        {step === 1 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Enter Received Quantities</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Ordered</th>
                    <th className="text-right">Prev. Received</th>
                    <th className="text-right">Pending</th>
                    <th className="text-right">Receiving Now *</th>
                    <th className="text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => {
                    const item = watchedItems[i] || {};
                    return (
                      <tr key={field.id}>
                        <td className="font-medium">{item.productName}</td>
                        <td className="text-right">{item.orderedQty}</td>
                        <td className="text-right text-gray-500">{item.receivedQty}</td>
                        <td className="text-right text-amber-600 font-medium">{item.pendingQty}</td>
                        <td className="text-right">
                          <input
                            type="number" min={0} max={item.pendingQty}
                            className="input w-24 text-right"
                            {...register(`items.${i}.receivingQty`, {
                              required: true, min: 0, max: item.pendingQty,
                              valueAsNumber: true
                            })}
                          />
                        </td>
                        <td className="text-right">{fmtCurrency(item.unitCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="text-right font-semibold">Total Receiving Value:</td>
                    <td className="text-right font-bold text-primary-700">{fmtCurrency(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(2)}>Next: Quality & Notes →</button>
            </div>
          </div>
        )}

        {/* Step 2 – Quality & Notes */}
        {step === 2 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Quality Inspection & Notes</h2>
            <div className="space-y-4">
              {fields.map((field, i) => {
                const item = watchedItems[i] || {};
                return (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{item.productName}</p>
                      <span className="text-sm text-gray-500">Receiving: {item.receivingQty} units</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">Quality Status</label>
                        <select className="input" {...register(`items.${i}.qualityStatus`)}>
                          <option value="ACCEPTED">Accepted</option>
                          <option value="PARTIAL">Partially Accepted</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Rejected Qty</label>
                        <input type="number" min={0} max={item.receivingQty} className="input"
                          {...register(`items.${i}.rejectedQty`, { min: 0, valueAsNumber: true })} />
                      </div>
                      <div>
                        <label className="label">Quality Notes</label>
                        <input className="input" placeholder="Optional notes…" {...register(`items.${i}.qualityNotes`)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <label className="label">General Remarks</label>
              <textarea className="input" rows={3} placeholder="Delivery condition, remarks…" {...register('notes')} />
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)}>Next: Review & Confirm →</button>
            </div>
          </div>
        )}

        {/* Step 3 – Confirm */}
        {step === 3 && selectedPO && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Review & Confirm GRN</h2>
            <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
              <div><span className="text-gray-500">PO Number</span><p className="font-medium">{selectedPO.poNumber}</p></div>
              <div><span className="text-gray-500">Supplier</span><p className="font-medium">{selectedPO.supplier?.name}</p></div>
              <div><span className="text-gray-500">Received Date</span><p className="font-medium">{fmtDate(watch('receivedDate'))}</p></div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Qty Receiving</th>
                    <th className="text-right">Qty Rejected</th>
                    <th>Quality</th>
                    <th className="text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {watchedItems.map((item, i) => (
                    <tr key={i}>
                      <td className="font-medium">{item.productName}</td>
                      <td className="text-right">{item.receivingQty}</td>
                      <td className="text-right text-red-500">{item.rejectedQty || 0}</td>
                      <td><span className="badge-blue">{item.qualityStatus}</span></td>
                      <td className="text-right">{fmtCurrency(item.receivingQty * item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right font-semibold">Total GRN Value:</td>
                    <td className="text-right font-bold text-primary-700">{fmtCurrency(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Confirming will update stock levels immediately. This action cannot be undone.
            </div>

            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button type="submit" disabled={submitting} className="btn-success">
                {submitting ? 'Submitting…' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
