import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Stepper from '../../components/Stepper';
import { fmtCurrency, fmtQty, getErrorMsg } from '../../components/utils';

const STEPS = ['Select Product', 'Adjustment Details', 'Review & Apply'];

export default function StockAdjustment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      productId: '',
      adjustmentType: 'ADJUSTMENT_IN',
      quantity: 1,
      reason: '',
      notes: '',
    },
  });

  const watchedProductId = watch('productId');
  const watchedAdjType = watch('adjustmentType');
  const watchedQty = Number(watch('quantity')) || 0;

  useEffect(() => {
    api.get('/products', { params: { limit: 300, status: 'ACTIVE' } }).then(r => setProducts(r.data.data || []));
  }, []);

  useEffect(() => {
    if (!watchedProductId) { setSelectedProduct(null); return; }
    setSelectedProduct(products.find(p => p.id === watchedProductId) || null);
  }, [watchedProductId, products]);

  const isIn = watchedAdjType === 'ADJUSTMENT_IN';
  const newStock = selectedProduct
    ? isIn
      ? selectedProduct.currentStock + watchedQty
      : selectedProduct.currentStock - watchedQty
    : 0;

  async function onSubmit(data) {
    setSubmitting(true);
    try {
      await api.post('/inventory/adjustment', {
        productId: data.productId,
        movementType: data.adjustmentType,
        quantity: Number(data.quantity),
        reason: data.reason,
        notes: data.notes || undefined,
      });
      toast.success('Stock adjusted successfully');
      navigate('/inventory/stock');
    } catch (err) {
      toast.error(getErrorMsg(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1>Stock Adjustment</h1>
          <p className="text-gray-500 text-sm mt-1">Add or remove stock manually</p>
        </div>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0 — Select Product */}
        {step === 0 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Select Product</h2>
            <div>
              <label className="label">Product *</label>
              <select className="input" {...register('productId', { required: 'Select a product' })}>
                <option value="">— Select Product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock} {p.unit})</option>
                ))}
              </select>
              {errors.productId && <p className="error-msg">{errors.productId.message}</p>}
            </div>

            {selectedProduct && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm grid grid-cols-3 gap-4">
                <div><span className="text-gray-500">Current Stock</span><p className="font-bold text-lg">{fmtQty(selectedProduct.currentStock, selectedProduct.unit)}</p></div>
                <div><span className="text-gray-500">Reserved</span><p className="font-medium">{selectedProduct.reservedStock || 0}</p></div>
                <div><span className="text-gray-500">Available</span><p className="font-medium">{selectedProduct.currentStock - (selectedProduct.reservedStock || 0)}</p></div>
                <div><span className="text-gray-500">Reorder Point</span><p className="font-medium">{selectedProduct.reorderPoint}</p></div>
                <div><span className="text-gray-500">Cost Price</span><p className="font-medium">{fmtCurrency(selectedProduct.costPrice)}</p></div>
              </div>
            )}

            <div className="flex justify-end">
              <button type="button" disabled={!selectedProduct} className="btn-primary" onClick={() => setStep(1)}>
                Next: Set Adjustment →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Adjustment Details */}
        {step === 1 && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Adjustment Details</h2>
            <div>
              <label className="label">Adjustment Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'ADJUSTMENT_IN', label: 'Stock In (+)', desc: 'Increase stock (found items, returns, corrections)' },
                  { value: 'ADJUSTMENT_OUT', label: 'Stock Out (-)', desc: 'Decrease stock (damage, loss, expiry)' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setValue('adjustmentType', opt.value)}
                    className={`border-2 rounded-xl p-4 text-left transition-all ${watchedAdjType === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className={`font-semibold ${opt.value === 'ADJUSTMENT_IN' ? 'text-green-600' : 'text-red-600'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Quantity *</label>
              <input type="number" min={1} className="input"
                {...register('quantity', { required: true, min: 1, valueAsNumber: true })} />
              {selectedProduct && !isIn && watchedQty > selectedProduct.currentStock && (
                <p className="error-msg">Quantity exceeds current stock ({selectedProduct.currentStock})</p>
              )}
            </div>
            <div>
              <label className="label">Reason *</label>
              <select className="input" {...register('reason', { required: 'Reason is required' })}>
                <option value="">— Select Reason —</option>
                {isIn ? (
                  <>
                    <option value="FOUND_ITEMS">Found / Located Items</option>
                    <option value="CUSTOMER_RETURN">Customer Return</option>
                    <option value="OPENING_BALANCE">Opening Balance</option>
                    <option value="PHYSICAL_COUNT">Physical Count Correction</option>
                  </>
                ) : (
                  <>
                    <option value="DAMAGED">Damaged / Defective</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="LOST_THEFT">Lost / Theft</option>
                    <option value="PHYSICAL_COUNT">Physical Count Correction</option>
                    <option value="QUALITY_REJECT">Quality Rejection</option>
                  </>
                )}
              </select>
              {errors.reason && <p className="error-msg">{errors.reason.message}</p>}
            </div>
            <div>
              <label className="label">Additional Notes</label>
              <textarea className="input" rows={2} placeholder="Optional details…" {...register('notes')} />
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(2)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Review */}
        {step === 2 && selectedProduct && (
          <div className="card card-body space-y-5">
            <h2 className="text-base font-semibold">Review Adjustment</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded-lg p-4">
                <div><span className="text-gray-500">Product</span><p className="font-bold text-base">{selectedProduct.name}</p></div>
                <div><span className="text-gray-500">Adjustment</span>
                  <p className={`font-bold text-base ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                    {isIn ? '+' : '-'}{watchedQty} {selectedProduct.unit}
                  </p>
                </div>
                <div><span className="text-gray-500">Current Stock</span><p className="font-medium">{fmtQty(selectedProduct.currentStock, selectedProduct.unit)}</p></div>
                <div><span className="text-gray-500">New Stock</span>
                  <p className={`font-bold text-base ${newStock < 0 ? 'text-red-600' : newStock <= selectedProduct.reorderPoint ? 'text-amber-600' : 'text-green-600'}`}>
                    {fmtQty(Math.max(0, newStock), selectedProduct.unit)}
                    {newStock < 0 && <span className="text-red-500 text-xs ml-1">(Cannot go negative)</span>}
                  </p>
                </div>
              </div>

              {newStock < 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  Adjustment quantity exceeds available stock. Please reduce the quantity.
                </div>
              )}

              {newStock >= 0 && newStock <= selectedProduct.reorderPoint && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  After this adjustment, stock will be at or below the reorder point ({selectedProduct.reorderPoint}).
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" disabled={submitting || newStock < 0} className="btn-primary">
                {submitting ? 'Applying…' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
