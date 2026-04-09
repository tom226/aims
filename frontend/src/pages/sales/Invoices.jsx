import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../../lib/api';
import { StatusBadge, fmtCurrency, fmtDate } from '../../components/utils';

const STATUS_OPTIONS = ['', 'DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    api.get('/invoices', { params: { search: search || undefined, status: status || undefined, page, limit: 20 } })
      .then(r => { setInvoices(r.data.data || []); setTotal(r.data.total || 0); })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1>Sales Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{total} total invoices</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/sales/invoices/new')}>
          <PlusIcon className="w-4 h-4" /> New Invoice
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by invoice or customer…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-44" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      <div className="table-container bg-white">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th className="text-right">Grand Total</th>
              <th className="text-right">Amount Paid</th>
              <th className="text-right">Balance Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No invoices found.</td></tr>
            ) : invoices.map(inv => {
              const balance = inv.grandTotal - (inv.amountPaid || 0);
              const isOverdue = inv.status === 'OVERDUE';
              return (
                <tr key={inv.id} className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/sales/invoices/${inv.id}`)}>
                  <td className="font-medium text-primary-600">{inv.invoiceNumber}</td>
                  <td>{inv.customer?.name}</td>
                  <td className="text-gray-500">{fmtDate(inv.invoiceDate)}</td>
                  <td className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}>{fmtDate(inv.dueDate)}</td>
                  <td className="text-right font-medium">{fmtCurrency(inv.grandTotal)}</td>
                  <td className="text-right text-green-600">{fmtCurrency(inv.amountPaid || 0)}</td>
                  <td className={`text-right font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtCurrency(balance)}</td>
                  <td><StatusBadge status={inv.status} /></td>
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
    </div>
  );
}
