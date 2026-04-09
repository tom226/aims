// Status badge color mapping
export const statusColors = {
  // PO
  DRAFT: 'badge-gray',
  PENDING_APPROVAL: 'badge-amber',
  APPROVED: 'badge-blue',
  SENT: 'badge-blue',
  PARTIALLY_RECEIVED: 'badge-amber',
  FULLY_RECEIVED: 'badge-green',
  CLOSED: 'badge-gray',
  CANCELLED: 'badge-red',
  // Invoice
  ISSUED: 'badge-blue',
  PARTIALLY_PAID: 'badge-amber',
  FULLY_PAID: 'badge-green',
  OVERDUE: 'badge-red',
  CREDITED: 'badge-purple',
  // SO
  CONFIRMED: 'badge-blue',
  PARTIALLY_INVOICED: 'badge-amber',
  FULLY_INVOICED: 'badge-green',
  // GRN
  CONFIRMED_GRN: 'badge-green',
  // Stock
  IN_STOCK: 'badge-green',
  LOW_STOCK: 'badge-amber',
  OUT_OF_STOCK: 'badge-red',
  // User
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-gray',
  BLACKLISTED: 'badge-red',
  ON_HOLD: 'badge-red',
};

export function StatusBadge({ status }) {
  const colorClass = statusColors[status] || 'badge-gray';
  const label = status?.replace(/_/g, ' ') || '—';
  return <span className={colorClass}>{label}</span>;
}

export function fmtCurrency(amount, currency = '₹') {
  if (amount === null || amount === undefined || isNaN(amount)) return `${currency}0.00`;
  return `${currency}${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(date, withTime = false) {
  if (!date) return '—';
  const d = new Date(date);
  if (withTime) {
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtQty(qty, unit = '') {
  if (qty === null || qty === undefined) return '—';
  return `${parseFloat(qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

export function getErrorMsg(err) {
  return err?.response?.data?.error || err?.response?.data?.errors?.[0]?.msg || err?.message || 'An unexpected error occurred.';
}
