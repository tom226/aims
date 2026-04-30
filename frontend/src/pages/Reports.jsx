import { useState } from 'react';
import api from '../lib/api';
import { fmtCurrency, fmtDate } from '../components/utils';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const REPORTS = [
  { id: 'purchase-register', label: 'Purchase Register', desc: 'All purchase orders within date range' },
  { id: 'sales-register', label: 'Sales Register', desc: 'All sales invoices within date range' },
  { id: 'outstanding-payments', label: 'Outstanding Payments', desc: 'Unpaid / partially paid invoices' },
  { id: 'stock-movement', label: 'Stock Movement', desc: 'Stock ledger entries for a period' },
  { id: 'reorder-report', label: 'Reorder Report', desc: 'Products at or below reorder point' },
  { id: 'po-invoice-reconciliation', label: 'PO-Invoice Reconciliation', desc: 'Match purchase orders to invoices' },
  { id: 'inventory-valuation', label: 'Inventory Valuation', desc: 'Current stock value at cost price' },
  { id: 'abc-analysis', label: 'ABC Analysis', desc: 'Classify products A/B/C by sales contribution' },
  { id: 'dead-stock', label: 'Dead Stock', desc: 'Products without movement in N days' },
  { id: 'stock-aging', label: 'Stock Aging', desc: 'Stock value by age buckets' },
  { id: 'customer-aging', label: 'Customer Aging', desc: 'Receivables aged 0-30-60-90+ days' },
  { id: 'profitability', label: 'Profitability', desc: 'Revenue vs cost margin per product' },
  { id: 'gst-summary', label: 'GST Summary', desc: 'HSN-wise tax summary (GSTR-1 like)' },
  { id: 'supplier-performance', label: 'Supplier Performance', desc: 'Fulfillment & on-time delivery rates' },
];

function PurchaseRegisterTable({ data }) {
  return (
    <table>
      <thead><tr><th>PO Number</th><th>Supplier</th><th>Date</th><th>Status</th><th className="text-right">Grand Total</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td className="font-medium">{r.poNumber}</td>
            <td>{r.supplier?.name}</td>
            <td className="text-gray-500">{fmtDate(r.orderDate)}</td>
            <td><span className="badge-gray">{r.status}</span></td>
            <td className="text-right">{fmtCurrency(r.grandTotal)}</td>
          </tr>))}
      </tbody>
    </table>
  );
}

function SalesRegisterTable({ data }) {
  return (
    <table>
      <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td className="font-medium">{r.invoiceNumber}</td>
            <td>{r.customer?.name}</td>
            <td className="text-gray-500">{fmtDate(r.invoiceDate)}</td>
            <td><span className="badge-gray">{r.status}</span></td>
            <td className="text-right">{fmtCurrency(r.grandTotal)}</td>
            <td className="text-right text-green-600">{fmtCurrency(r.amountPaid || 0)}</td>
            <td className="text-right text-red-600">{fmtCurrency(r.grandTotal - (r.amountPaid || 0))}</td>
          </tr>))}
      </tbody>
    </table>
  );
}

function OutstandingTable({ data }) {
  return (
    <table>
      <thead><tr><th>Invoice #</th><th>Customer</th><th>Due Date</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td className="font-medium">{r.invoiceNumber}</td>
            <td>{r.customer?.name}</td>
            <td className={r.status === 'OVERDUE' ? 'text-red-600 font-medium' : 'text-gray-500'}>{fmtDate(r.dueDate)}</td>
            <td className="text-right text-red-600 font-medium">{fmtCurrency(r.grandTotal - (r.amountPaid || 0))}</td>
            <td><span className="badge-red">{r.status}</span></td>
          </tr>))}
      </tbody>
    </table>
  );
}

function StockMovementTable({ data }) {
  return (
    <table>
      <thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="text-right">Qty</th><th>Reference</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id}>
            <td className="text-gray-500">{fmtDate(r.createdAt)}</td>
            <td className="font-medium">{r.product?.name}</td>
            <td><span className="badge-gray">{r.movementType}</span></td>
            <td className="text-right">{r.quantity}</td>
            <td className="text-gray-500">{r.referenceNumber || '—'}</td>
          </tr>))}
      </tbody>
    </table>
  );
}

function ReorderTable({ data }) {
  return (
    <table>
      <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Current Stock</th><th className="text-right">Reorder Pt.</th><th className="text-right">Reorder Qty</th><th>Supplier</th></tr></thead>
      <tbody>
        {data.map(r => (
          <tr key={r.id} className="bg-amber-50">
            <td className="font-medium">{r.name}</td>
            <td className="text-gray-500">{r.sku || '—'}</td>
            <td className="text-right text-red-600 font-semibold">{r.currentStock}</td>
            <td className="text-right">{r.reorderPoint}</td>
            <td className="text-right text-primary-600 font-medium">{r.reorderQty}</td>
            <td>{r.supplier?.name || '—'}</td>
          </tr>))}
      </tbody>
    </table>
  );
}

function InventoryValuationTable({ data }) {
  const totalValue = data.reduce((s, r) => s + r.currentStock * r.costPrice, 0);
  return (
    <>
      <table>
        <thead><tr><th>Product</th><th>Unit</th><th className="text-right">In Stock</th><th className="text-right">Cost Price</th><th className="text-right">Stock Value</th></tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.id}>
              <td className="font-medium">{r.name}</td>
              <td>{r.unit}</td>
              <td className="text-right">{r.currentStock}</td>
              <td className="text-right">{fmtCurrency(r.costPrice)}</td>
              <td className="text-right font-medium">{fmtCurrency(r.currentStock * r.costPrice)}</td>
            </tr>))}
        </tbody>
        <tfoot>
          <tr><td colSpan={4} className="text-right font-bold">Total Inventory Value</td><td className="text-right font-bold text-primary-700">{fmtCurrency(totalValue)}</td></tr>
        </tfoot>
      </table>
    </>
  );
}

function GenericTable({ data }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
  return (
    <table>
      <thead><tr>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
      <tbody>{data.map((r, i) => <tr key={i}>{keys.map(k => <td key={k}>{String(r[k] ?? '—')}</td>)}</tr>)}</tbody>
    </table>
  );
}

function ResultTable({ reportId, data }) {
  if (!data || data.length === 0) return <p className="text-center py-10 text-gray-400">No data for the selected criteria.</p>;
  const tables = {
    'purchase-register': PurchaseRegisterTable,
    'sales-register': SalesRegisterTable,
    'outstanding-payments': OutstandingTable,
    'stock-movement': StockMovementTable,
    'reorder-report': ReorderTable,
    'inventory-valuation': InventoryValuationTable,
  };
  const Table = tables[reportId] || GenericTable;
  return (
    <div className="table-container">
      <Table data={data} />
    </div>
  );
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState('purchase-register');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runReport() {
    setLoading(true);
    setResults(null);
    try {
      // Some reports use from/to instead of fromDate/toDate, plus extra params
      const params = { fromDate, toDate, from: fromDate, to: toDate };
      if (activeReport === 'dead-stock') params.days = 90;
      const res = await api.get(`/reports/${activeReport}`, { params });
      // Different shapes
      const d = res.data;
      if (Array.isArray(d)) setResults(d);
      else if (d.data) setResults(d.data);
      else if (d.hsnSummary) setResults(d.hsnSummary);
      else setResults([d]);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-100 p-2 space-y-1 h-fit">
          {REPORTS.map(r => (
            <button key={r.id}
              onClick={() => { setActiveReport(r.id); setResults(null); }}
              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${activeReport === r.id ? 'bg-primary-600 text-white' : 'hover:bg-gray-50 text-gray-700'}`}>
              <p className="text-sm font-medium">{r.label}</p>
              <p className={`text-xs mt-0.5 ${activeReport === r.id ? 'text-blue-100' : 'text-gray-400'}`}>{r.desc}</p>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="col-span-9 space-y-4">
          <div className="card card-body">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label">From Date</label>
                <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={runReport} disabled={loading}>
                {loading ? 'Running…' : 'Run Report'}
              </button>
              {results && results.length > 0 && (
                <button className="btn-secondary" onClick={() => {
                  const csv = [
                    Object.keys(results[0]).join(','),
                    ...results.map(r => Object.values(r).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')).join(','))
                  ].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${activeReport}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <ArrowDownTrayIcon className="w-4 h-4" /> Export CSV
                </button>
              )}
            </div>
          </div>

          {results !== null && (
            <div className="card card-body">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{REPORTS.find(r => r.id === activeReport)?.label}</h2>
                <span className="text-sm text-gray-500">{Array.isArray(results) ? results.length : 0} records</span>
              </div>
              <ResultTable reportId={activeReport} data={Array.isArray(results) ? results : [results]} />
            </div>
          )}

          {results === null && !loading && (
            <div className="card card-body text-center py-16 text-gray-400">
              <p className="text-lg">Select a report and click <strong>Run Report</strong></p>
              <p className="text-sm mt-2">Results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
