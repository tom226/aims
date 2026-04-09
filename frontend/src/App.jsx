import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PurchaseOrders from './pages/purchase/PurchaseOrders';
import CreatePO from './pages/purchase/CreatePO';
import PODetail from './pages/purchase/PODetail';
import GoodsReceipt from './pages/purchase/GoodsReceipt';
import CreateGRN from './pages/purchase/CreateGRN';
import Suppliers from './pages/purchase/Suppliers';
import SalesOrders from './pages/sales/SalesOrders';
import CreateSO from './pages/sales/CreateSO';
import SODetail from './pages/sales/SODetail';
import Invoices from './pages/sales/Invoices';
import CreateInvoice from './pages/sales/CreateInvoice';
import InvoiceDetail from './pages/sales/InvoiceDetail';
import Customers from './pages/sales/Customers';
import Products from './pages/inventory/Products';
import StockSummary from './pages/inventory/StockSummary';
import StockLedger from './pages/inventory/StockLedger';
import StockAdjustment from './pages/inventory/StockAdjustment';
import Reports from './pages/Reports';
import Users from './pages/settings/Users';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          {/* Purchase */}
          <Route path="purchase/orders" element={<PurchaseOrders />} />
          <Route path="purchase/orders/new" element={<CreatePO />} />
          <Route path="purchase/orders/:id" element={<PODetail />} />
          <Route path="purchase/grn" element={<GoodsReceipt />} />
          <Route path="purchase/grn/new" element={<CreateGRN />} />
          <Route path="purchase/suppliers" element={<Suppliers />} />
          {/* Sales */}
          <Route path="sales/orders" element={<SalesOrders />} />
          <Route path="sales/orders/new" element={<CreateSO />} />
                    <Route path="sales/orders/:id" element={<SODetail />} />
          <Route path="sales/invoices" element={<Invoices />} />
          <Route path="sales/invoices/new" element={<CreateInvoice />} />
          <Route path="sales/invoices/:id" element={<InvoiceDetail />} />
          <Route path="sales/customers" element={<Customers />} />
          {/* Inventory */}
          <Route path="inventory/products" element={<Products />} />
          <Route path="inventory/stock" element={<StockSummary />} />
          <Route path="inventory/ledger" element={<StockLedger />} />
          <Route path="inventory/adjustments" element={<StockAdjustment />} />
          {/* Reports */}
          <Route path="reports" element={<Reports />} />
          {/* Settings */}
          <Route path="settings/users" element={<Users />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
