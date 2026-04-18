import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, TruckIcon, PrinterIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { fmtCurrency, fmtDate, StatusBadge, getErrorMsg } from '../../components/utils';

// ─── Company constants (Origins Advertising Pvt. Ltd.) ────────────────────────
const COMPANY = {
  name: 'ORGINS ADVERTISING PRIVATE LIMITED',
  legalName: 'ORIGINS ADVERTISING PRIVATE LIMITED',
  tagline: '(An ISO 9001:2015 Certified Company)',
  address1: '2nd Floor, Akarshan Complex,',
  address2: 'S82 - 383, Vibhuti Khand, Gomti Nagar,',
  address3: 'Lucknow,',
  address4: 'Uttar Pradesh - 226010',
  gstin: '09AAACO4413E1ZT',
  pan: 'AAAC04413E',
  cin: 'U74300UP2000PTC025234',
  regd: 'Regd. Office: 2nd Floor, 382 - 383 Akarshan Complex, Vibhuti Khand, Gomti Nagar, Lucknow - 226010.',
  branches: 'Branch Office: Kanpur  ||  Noida  ||  Delhi  ||  Dehradun',
  tel: 'Tel: +91 522 4922222 (64 Lines), Fax: +91 522 2720927  •  E-mail: info@origins.co.in  Website: www.origins.co.in',
};

const TERMS = [
  'The bill should be submitted within 10 days of the GPO being issued; otherwise, Origins Advertising Pvt. Ltd. shall not be responsible for the payment.',
  'The G.P.O. number must be clearly mentioned on all invoices.',
  'G.S.T. and PAN numbers must be mentioned on the invoices.',
  'Payment will be made only after the successful completion of services or receipt of materials as per the order.',
];

const thS = { border: '1px solid #000', padding: '5px 6px', textAlign: 'left', fontWeight: 'bold', fontSize: '11px', background: '#f0f0f0' };
const tdS = { border: '1px solid #000', padding: '4px 6px', verticalAlign: 'top', fontSize: '11px' };

// ─── GPO Print View ───────────────────────────────────────────────────────────
function GPOPrintView({ po }) {
  const subTotal = parseFloat(po.subTotal);
  const transportCharges = parseFloat(po.additionalCharges);
  const gstAmount = parseFloat(po.taxAmount);
  const grandTotal = parseFloat(po.grandTotal);
  const gstRate = po.items?.length > 0 ? parseFloat(po.items[0].taxRate) : 18;
  const dateStr = new Date(po.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

  return (
    <div id="gpo-print-area" style={{ position: 'absolute', left: '-99999px', top: 0 }}>
      <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000', maxWidth: '820px', margin: '0 auto', padding: '20px 30px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '6px' }}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '2px' }}>ORIGINS</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '2px' }}>G. P. O.</div>
        </div>

        {/* Company info + Date/GPO# */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
          <tbody>
            <tr>
              <td style={{ width: '65%', verticalAlign: 'top', padding: '4px 0' }}>
                <div style={{ fontWeight: 'bold' }}>{COMPANY.name}</div>
                <div>{COMPANY.address1}</div>
                <div>{COMPANY.address2}</div>
                <div>{COMPANY.address3}</div>
                <div>{COMPANY.address4}</div>
                <div style={{ marginTop: '3px' }}><strong>GST No. : {COMPANY.gstin}</strong></div>
                <div><strong>PAN No. : {COMPANY.pan}</strong></div>
                <div><strong>CIN No. : {COMPANY.cin}</strong></div>
              </td>
              <td style={{ width: '35%', verticalAlign: 'top', padding: '4px 0', textAlign: 'right' }}>
                <table style={{ marginLeft: 'auto', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={{ paddingRight: '8px' }}><strong>Date :</strong></td><td>{dateStr}</td></tr>
                    <tr><td style={{ paddingRight: '8px' }}><strong>G. P. O. No. :</strong></td><td>{po.poNumber}</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Supplier box */}
        <table style={{ width: '100%', border: '1px solid #000', borderCollapse: 'collapse', marginTop: '8px', marginBottom: '8px' }}>
          <tbody>
            <tr>
              <td style={{ width: '60%', verticalAlign: 'top', padding: '6px 8px', borderRight: '1px solid #000' }}>
                <div><strong>M/s.</strong></div>
                <div style={{ fontWeight: 'bold' }}>{po.supplier?.name}</div>
                {po.supplier?.billingAddress && <div>{po.supplier.billingAddress}</div>}
                {po.supplier?.email && <div>Email Id : {po.supplier.email}</div>}
                {po.supplier?.phone && <div>Phone No. : {po.supplier.phone}</div>}
              </td>
              <td style={{ width: '40%', verticalAlign: 'top', padding: '6px 8px' }}>
                {po.supplier?.gstin && <div><strong>GST No. : {po.supplier.gstin}</strong></div>}
                {po.supplier?.pan && <div><strong>PAN No. : {po.supplier.pan}</strong></div>}
                {po.deliveryLocation && <div style={{ marginTop: '4px' }}><strong>Delivery :</strong> {po.deliveryLocation}</div>}
                {po.expectedDeliveryDate && <div><strong>Expected By :</strong> {fmtDate(po.expectedDeliveryDate)}</div>}
                {po.paymentTerms && <div><strong>Payment Terms :</strong> {po.paymentTerms}</div>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line items table */}
        <table style={{ width: '100%', border: '1px solid #000', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <thead>
            <tr>
              <th style={thS}>Sr. No.</th>
              <th style={thS}>Particulars / Services</th>
              <th style={{ ...thS, width: '30%' }}>Description</th>
              <th style={thS}>Qty.</th>
              <th style={thS}>Rate (In Rs.)</th>
              <th style={{ ...thS, textAlign: 'right' }}>Total Amount (In Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {po.items?.map((item, idx) => (
              <tr key={item.id}>
                <td style={tdS}>{idx + 1}</td>
                <td style={tdS}>{item.product?.name}</td>
                <td style={tdS}>{item.description || ''}</td>
                <td style={tdS}>{parseFloat(item.quantityOrdered)} {item.product?.unit || ''}</td>
                <td style={tdS}>{parseFloat(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>
                  {(parseFloat(item.quantityOrdered) * parseFloat(item.unitPrice)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {Array.from({ length: Math.max(0, 4 - (po.items?.length || 0)) }).map((_, i) => (
              <tr key={`pad-${i}`} style={{ height: '22px' }}>
                {[...Array(6)].map((__, j) => <td key={j} style={tdS}>&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Remarks + Totals */}
        <table style={{ width: '100%', border: '1px solid #000', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px', width: '15%', borderRight: '1px solid #000', verticalAlign: 'top' }}><strong>REMARKS :</strong></td>
              <td style={{ padding: '4px 8px', width: '55%', borderRight: '1px solid #000', verticalAlign: 'top' }}>{po.notes || ''}</td>
              <td style={{ padding: '4px 8px', width: '30%', verticalAlign: 'top' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>Total</td>
                      <td style={{ textAlign: 'right', paddingBottom: '2px' }}>{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>Transportation Charges</td>
                      <td style={{ textAlign: 'right', paddingBottom: '2px' }}>{transportCharges > 0 ? transportCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingBottom: '2px' }}>GST {gstRate}%</td>
                      <td style={{ textAlign: 'right', paddingBottom: '2px' }}>{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #000', fontWeight: 'bold' }}>
                      <td style={{ paddingTop: '2px' }}>Grand Total</td>
                      <td style={{ textAlign: 'right', paddingTop: '2px' }}>{Math.round(grandTotal).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: 'right', fontSize: '10px', marginBottom: '6px' }}>E. &amp; OE.</div>

        {/* Note */}
        <div style={{ border: '1px solid #000', padding: '6px 8px', marginBottom: '4px' }}>
          <strong>Note -</strong><br />G. S. T. Included
        </div>

        {/* Terms & Conditions */}
        <div style={{ border: '1px solid #000', padding: '6px 8px', marginBottom: '10px' }}>
          <div style={{ marginBottom: '3px' }}><strong>Terms &amp; Conditions :</strong></div>
          {TERMS.map((t, i) => <div key={i} style={{ marginBottom: '2px' }}>{i + 1}). {t}</div>)}
        </div>

        {/* Signatures */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
          <tbody>
            <tr>
              {['Issued By\nCommercial Dept.', 'Verified By\nDept. Head', 'Authorized By', 'Approved By'].map((label) => (
                <td key={label} style={{ width: '25%', textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '40px', paddingTop: '10px' }} />
              ))}
            </tr>
            <tr>
              <td style={{ textAlign: 'center', paddingTop: '4px' }}><strong>Issued By</strong><br /><span>Commercial Dept.</span></td>
              <td style={{ textAlign: 'center', paddingTop: '4px' }}><strong>Verified By</strong><br /><span>Dept. Head</span></td>
              <td style={{ textAlign: 'center', paddingTop: '4px' }}><strong>Authorized By</strong></td>
              <td style={{ textAlign: 'center', paddingTop: '4px' }}><strong>Approved By</strong></td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ borderTop: '2px solid #000', paddingTop: '8px', textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{COMPANY.legalName}</div>
          <div style={{ fontSize: '10px', marginBottom: '3px' }}>{COMPANY.tagline}</div>
          <div style={{ fontSize: '10px' }}>{COMPANY.regd}</div>
          <div style={{ fontSize: '10px' }}>{COMPANY.branches}</div>
          <div style={{ fontSize: '10px' }}>{COMPANY.tel}</div>
        </div>

      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PODetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchPO = async () => {
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data);
    } catch { toast.error('PO not found'); navigate(-1); }
    setLoading(false);
  };

  useEffect(() => { fetchPO(); }, [id]);

  const updateStatus = async (status) => {
    setStatusLoading(true);
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status });
      toast.success(`PO status updated to ${status.replace(/_/g, ' ')}`);
      fetchPO();
    } catch (err) { toast.error(getErrorMsg(err)); }
    setStatusLoading(false);
  };

  const handlePrint = () => {
    const el = document.getElementById('gpo-print-area');
    if (!el) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the G.P.O.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${po.poNumber}</title>
          <style>
            @page { size: A4; margin: 8mm; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { font-family: Arial, sans-serif; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>${el.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!po) return null;

  const totalOrdered = po.items?.reduce((s, i) => s + parseFloat(i.quantityOrdered), 0) || 0;
  const totalReceived = po.items?.reduce((s, i) => s + parseFloat(i.quantityReceived), 0) || 0;
  const receivedPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm"><ChevronLeftIcon className="w-4 h-4" /> Back</button>
        <div>
          <h1>{po.poNumber}</h1>
          <p className="text-gray-500 text-sm">Created {fmtDate(po.createdAt)} by {po.createdBy?.name}</p>
        </div>
        <div className="ml-auto flex gap-2 flex-wrap">
          <StatusBadge status={po.status} />
          <button className="btn-secondary btn-sm" onClick={handlePrint}>
            <PrinterIcon className="w-4 h-4" /> Print G.P.O.
          </button>
          {po.status === 'DRAFT' && <button className="btn-primary btn-sm" onClick={() => updateStatus('APPROVED')} disabled={statusLoading}>Approve PO</button>}
          {po.status === 'APPROVED' && <button className="btn-primary btn-sm" onClick={() => updateStatus('SENT')} disabled={statusLoading}>Mark as Sent</button>}
          {['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'].includes(po.status) && (
            <button className="btn-success btn-sm" onClick={() => navigate(`/purchase/grn/new?poId=${id}`)}>
              <TruckIcon className="w-4 h-4" /> Receive Goods
            </button>
          )}
          {!['CLOSED', 'CANCELLED', 'FULLY_RECEIVED'].includes(po.status) && (
            <button className="btn-danger btn-sm" onClick={() => updateStatus('CANCELLED')} disabled={statusLoading}>Cancel PO</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Supplier', value: po.supplier?.name },
          { label: 'Grand Total', value: fmtCurrency(po.grandTotal) },
          { label: 'Expected Delivery', value: fmtDate(po.expectedDeliveryDate) },
          { label: 'Payment Terms', value: po.paymentTerms || '—' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="font-semibold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Receipt Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Receipt Progress</span>
          <span className="text-sm font-bold text-primary-600">{receivedPct}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${receivedPct}%` }} />
        </div>
      </div>

      {/* Line Items */}
      <div className="card">
        <div className="card-header"><h3>Line Items</h3></div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Description</th><th>SKU</th><th>Ordered</th>
                <th>Received</th><th>Pending</th><th>Unit Price</th><th>Tax</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {po.items?.map(item => {
                const pending = parseFloat(item.quantityOrdered) - parseFloat(item.quantityReceived);
                return (
                  <tr key={item.id}>
                    <td className="font-medium">{item.product?.name}</td>
                    <td className="text-gray-500 text-xs max-w-xs truncate">{item.description || '—'}</td>
                    <td className="text-gray-400">{item.product?.sku}</td>
                    <td>{parseFloat(item.quantityOrdered)}</td>
                    <td className="text-green-700 font-medium">{parseFloat(item.quantityReceived)}</td>
                    <td className={pending > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{pending > 0 ? pending : '—'}</td>
                    <td>{fmtCurrency(item.unitPrice)}</td>
                    <td>{parseFloat(item.taxRate)}%</td>
                    <td className="font-semibold">{fmtCurrency(item.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex justify-end">
          <div className="text-sm space-y-1 min-w-[220px]">
            <div className="flex justify-between"><span>Sub Total:</span><span>{fmtCurrency(po.subTotal)}</span></div>
            <div className="flex justify-between"><span>Transportation Charges:</span><span>{fmtCurrency(po.additionalCharges)}</span></div>
            <div className="flex justify-between"><span>GST:</span><span>{fmtCurrency(po.taxAmount)}</span></div>
            <div className="flex justify-between font-bold border-t pt-2"><span>Grand Total:</span><span>{fmtCurrency(po.grandTotal)}</span></div>
          </div>
        </div>
      </div>

      {/* GRNs */}
      {po.grns?.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Goods Receipt Notes</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>GRN Number</th><th>Date</th><th>Status</th><th>Items</th></tr></thead>
              <tbody>
                {po.grns.map(grn => (
                  <tr key={grn.id}>
                    <td className="font-medium text-primary-600">{grn.grnNumber}</td>
                    <td>{fmtDate(grn.receivedDate)}</td>
                    <td><StatusBadge status={grn.status} /></td>
                    <td>{grn.items?.length} items</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden GPO print area */}
      {po && <GPOPrintView po={po} />}
    </div>
  );
}
