import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  ShoppingCartIcon, DocumentTextIcon, ExclamationTriangleIcon,
  CurrencyRupeeIcon, PlusIcon, ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import api from '../lib/api';
import { fmtCurrency, fmtDate, StatusBadge } from '../components/utils';

const PIE_COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

function KPICard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="stat-card flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recent = data?.recentActivity || {};

  // Merge charts for combined bar chart
  const combinedChart = (() => {
    const map = {};
    (charts.salesLast30 || []).forEach(d => { map[d.date] = { date: d.date, Sales: d.sales }; });
    (charts.purchaseLast30 || []).forEach(d => {
      if (map[d.date]) map[d.date].Purchases = d.purchases;
      else map[d.date] = { date: d.date, Purchases: d.purchases };
    });
    return Object.values(map).slice(-14).map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">Business overview for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/purchase/orders/new')} className="btn-secondary btn-sm">
            <PlusIcon className="w-3.5 h-3.5" /> New PO
          </button>
          <button onClick={() => navigate('/sales/invoices/new')} className="btn-primary btn-sm">
            <PlusIcon className="w-3.5 h-3.5" /> New Invoice
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Today's Sales" value={fmtCurrency(kpis.todaySales)} sub={`${kpis.todaySalesCount || 0} invoices`} icon={CurrencyRupeeIcon} color="bg-blue-100 text-blue-700" />
        <KPICard label="Month's Purchases" value={fmtCurrency(kpis.monthPurchases)} icon={ShoppingCartIcon} color="bg-purple-100 text-purple-700" />
        <KPICard label="Outstanding" value={fmtCurrency(kpis.outstandingAmount)} sub={`${kpis.outstandingCount || 0} invoices`} icon={DocumentTextIcon} color="bg-amber-100 text-amber-700" />
        <KPICard label="Low Stock Alerts" value={kpis.lowStockCount || 0} sub="products at reorder level" icon={ExclamationTriangleIcon} color="bg-red-100 text-red-700" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales vs Purchases */}
        <div className="card col-span-2">
          <div className="card-header">
            <h3>Sales vs Purchases (Last 14 days)</h3>
          </div>
          <div className="card-body pt-0 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={combinedChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmtCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Sales" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Purchases" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Donut */}
        <div className="card">
          <div className="card-header">
            <h3>Invoice Status</h3>
          </div>
          <div className="card-body pt-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={charts.invoiceStatus || []} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={75} innerRadius={45}>
                  {(charts.invoiceStatus || []).map((e, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n.replace(/_/g, ' ')]} />
                <Legend formatter={v => v.replace(/_/g, ' ')} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="card">
          <div className="card-header">
            <h3>Top Selling Products (30 days)</h3>
          </div>
          <div className="card-body pt-0">
            {(charts.topProducts || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No sales data yet</p>
            ) : (
              <div className="space-y-3 mt-2">
                {charts.topProducts.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmtCurrency(p.revenue)}</p>
                      <p className="text-xs text-gray-500">{parseFloat(p.totalSold).toFixed(0)} units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body pt-0">
            <div className="space-y-2 mt-2">
              {[
                ...(recent.purchaseOrders || []).map(po => ({ type: 'PO', id: po.id, ref: po.poNumber, party: po.supplier?.name, amount: po.grandTotal, status: po.status, date: po.createdAt, path: `/purchase/orders/${po.id}` })),
                ...(recent.invoices || []).map(inv => ({ type: 'INV', id: inv.id, ref: inv.invoiceNumber, party: inv.customer?.name, amount: inv.grandTotal, status: inv.status, date: inv.createdAt, path: `/sales/invoices/${inv.id}` })),
              ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate(item.path)}>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.type === 'PO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {item.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.ref}</p>
                    <p className="text-xs text-gray-500 truncate">{item.party}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtCurrency(item.amount)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(item.date)}</p>
                  </div>
                </div>
              ))}
              {(recent.purchaseOrders || []).length === 0 && (recent.invoices || []).length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
