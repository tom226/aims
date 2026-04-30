const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/reports/purchase-register
router.get('/purchase-register', authenticate, async (req, res, next) => {
  try {
    const { from, to, supplierId, status } = req.query;
    const where = {};
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const data = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/reports/sales-register
router.get('/sales-register', authenticate, async (req, res, next) => {
  try {
    const { from, to, customerId, status } = req.query;
    const where = {};
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;

    const data = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, hsnCode: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(data.map(inv => ({ ...inv, balanceDue: parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid) })));
  } catch (err) { next(err); }
});

// GET /api/reports/outstanding-payments
router.get('/outstanding-payments', authenticate, async (req, res, next) => {
  try {
    const data = await prisma.invoice.findMany({
      where: { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { customer: { select: { name: true, phone: true, email: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const today = new Date();
    const enriched = data.map(inv => {
      const balanceDue = parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid);
      const daysOverdue = inv.dueDate ? Math.max(0, Math.floor((today - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24))) : 0;
      return { ...inv, balanceDue, daysOverdue };
    });
    res.json(enriched);
  } catch (err) { next(err); }
});

// GET /api/reports/stock-movement
router.get('/stock-movement', authenticate, async (req, res, next) => {
  try {
    const { productId, from, to, movementType } = req.query;
    const where = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);

    const data = await prisma.stockLedgerEntry.findMany({
      where,
      include: { product: { select: { name: true, sku: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/reports/reorder-report
router.get('/reorder-report', authenticate, async (req, res, next) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT p.id, p.sku, p.name, p."currentStock"::float, p."reorderLevel"::float,
             p."reorderQuantity"::float, p."sellingPrice"::float, p."costPrice"::float,
             s.name as "supplierName", s.id as "supplierId",
             c.name as "categoryName"
      FROM products p
      LEFT JOIN suppliers s ON p."preferredSupplierId" = s.id
      LEFT JOIN categories c ON p."categoryId" = c.id
      WHERE p."currentStock" <= p."reorderLevel" AND p.status = 'ACTIVE'
      ORDER BY p."currentStock" ASC
    `;
    res.json(products);
  } catch (err) { next(err); }
});

// GET /api/reports/po-invoice-reconciliation
router.get('/po-invoice-reconciliation', authenticate, async (req, res, next) => {
  try {
    const { from, to, supplierId } = req.query;
    const where = { linkedPoId: { not: null } };
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        customer: { select: { name: true } },
        linkedPo: { include: { supplier: { select: { name: true } } } },
        createdBy: { select: { name: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = invoices
      .filter(inv => !supplierId || inv.linkedPo?.supplierId === supplierId)
      .map(inv => {
        const poCost = inv.items.reduce((sum, item) => sum + (parseFloat(item.costPrice) * parseFloat(item.quantity)), 0);
        const revenue = parseFloat(inv.grandTotal);
        const margin = revenue > 0 ? ((revenue - poCost) / revenue) * 100 : 0;
        return {
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          customer: inv.customer.name,
          poNumber: inv.linkedPo?.poNumber || 'N/A',
          supplier: inv.linkedPo?.supplier?.name || 'N/A',
          poCost,
          revenue,
          grossMargin: margin.toFixed(2),
          salesperson: inv.createdBy.name,
          status: inv.status,
        };
      });

    res.json(data);
  } catch (err) { next(err); }
});

// GET /api/reports/inventory-valuation
router.get('/inventory-valuation', authenticate, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    let totalCostValue = 0;
    let totalSellingValue = 0;
    const data = products.map(p => {
      const costValue = parseFloat(p.currentStock) * parseFloat(p.costPrice);
      const sellingValue = parseFloat(p.currentStock) * parseFloat(p.sellingPrice);
      totalCostValue += costValue;
      totalSellingValue += sellingValue;
      return { ...p, costValue, sellingValue };
    });

    res.json({ data, totalCostValue, totalSellingValue });
  } catch (err) { next(err); }
});

// GET /api/reports/abc-analysis - classify products A/B/C by sales value
router.get('/abc-analysis', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) where.invoice = { invoiceDate: {} };
    if (from) where.invoice.invoiceDate.gte = new Date(from);
    if (to) where.invoice.invoiceDate.lte = new Date(to);

    const items = await prisma.invoiceItem.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true, currentStock: true } } },
    });

    const map = new Map();
    items.forEach((it) => {
      const key = it.productId;
      const val = parseFloat(it.total);
      const qty = parseFloat(it.quantity);
      const cur = map.get(key) || { product: it.product, totalSales: 0, totalQty: 0 };
      cur.totalSales += val;
      cur.totalQty += qty;
      map.set(key, cur);
    });

    const arr = Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales);
    const grandTotal = arr.reduce((s, r) => s + r.totalSales, 0) || 1;
    let cum = 0;
    const data = arr.map((r) => {
      cum += r.totalSales;
      const cumPct = (cum / grandTotal) * 100;
      let cls = 'C';
      if (cumPct <= 70) cls = 'A';
      else if (cumPct <= 90) cls = 'B';
      return {
        productId: r.product.id,
        name: r.product.name,
        sku: r.product.sku,
        currentStock: parseFloat(r.product.currentStock),
        totalQty: r.totalQty,
        totalSales: r.totalSales,
        cumulativePct: Number(cumPct.toFixed(2)),
        class: cls,
      };
    });
    res.json({ data, summary: {
      A: data.filter(d => d.class === 'A').length,
      B: data.filter(d => d.class === 'B').length,
      C: data.filter(d => d.class === 'C').length,
    }});
  } catch (err) { next(err); }
});

// GET /api/reports/dead-stock - no movement in N days
router.get('/dead-stock', authenticate, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '90', 10);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', currentStock: { gt: 0 } },
      include: {
        stockLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });

    const dead = products
      .map((p) => {
        const last = p.stockLedgerEntries[0]?.createdAt;
        const lastDate = last ? new Date(last) : p.createdAt;
        const daysSince = Math.floor((Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
        return {
          id: p.id, name: p.name, sku: p.sku, currentStock: parseFloat(p.currentStock),
          costPrice: parseFloat(p.costPrice),
          stockValue: parseFloat(p.currentStock) * parseFloat(p.costPrice),
          lastMovement: lastDate, daysSinceMovement: daysSince,
        };
      })
      .filter((p) => p.daysSinceMovement >= days)
      .sort((a, b) => b.stockValue - a.stockValue);

    const totalValue = dead.reduce((s, d) => s + d.stockValue, 0);
    res.json({ data: dead, threshold: days, totalValue });
  } catch (err) { next(err); }
});

// GET /api/reports/customer-aging - receivables aged in buckets
router.get('/customer-aging', authenticate, async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { customer: { select: { id: true, name: true, gstin: true } } },
    });

    const today = new Date();
    const customerMap = new Map();
    invoices.forEach((inv) => {
      const balance = parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid);
      if (balance <= 0) return;
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
      const days = Math.max(0, Math.floor((today - due) / (1000 * 60 * 60 * 24)));
      const bucket = days === 0 ? 'current' : days <= 30 ? 'd30' : days <= 60 ? 'd60' : days <= 90 ? 'd90' : 'd90p';
      const key = inv.customerId;
      const cur = customerMap.get(key) || { customer: inv.customer, current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 };
      cur[bucket] += balance;
      cur.total += balance;
      customerMap.set(key, cur);
    });

    const data = Array.from(customerMap.values()).sort((a, b) => b.total - a.total);
    const totals = data.reduce((acc, r) => {
      acc.current += r.current; acc.d30 += r.d30; acc.d60 += r.d60; acc.d90 += r.d90; acc.d90p += r.d90p; acc.total += r.total;
      return acc;
    }, { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 });
    res.json({ data, totals });
  } catch (err) { next(err); }
});

// GET /api/reports/profitability - margin per product or category
router.get('/profitability', authenticate, async (req, res, next) => {
  try {
    const { from, to, groupBy = 'product' } = req.query;
    const where = {};
    if (from || to) where.invoice = { invoiceDate: {} };
    if (from) where.invoice.invoiceDate.gte = new Date(from);
    if (to) where.invoice.invoiceDate.lte = new Date(to);

    const items = await prisma.invoiceItem.findMany({
      where,
      include: { product: { include: { category: true } } },
    });

    const map = new Map();
    items.forEach((it) => {
      const key = groupBy === 'category' ? (it.product.category?.name || 'Uncategorized') : it.product.name;
      const revenue = parseFloat(it.total);
      const cost = parseFloat(it.costPrice) * parseFloat(it.quantity);
      const cur = map.get(key) || { name: key, revenue: 0, cost: 0, qty: 0 };
      cur.revenue += revenue; cur.cost += cost; cur.qty += parseFloat(it.quantity);
      map.set(key, cur);
    });

    const data = Array.from(map.values()).map((r) => ({
      ...r,
      profit: r.revenue - r.cost,
      marginPct: r.revenue > 0 ? Number(((r.revenue - r.cost) / r.revenue * 100).toFixed(2)) : 0,
    })).sort((a, b) => b.profit - a.profit);

    const totals = data.reduce((acc, r) => ({ revenue: acc.revenue + r.revenue, cost: acc.cost + r.cost, profit: acc.profit + r.profit }), { revenue: 0, cost: 0, profit: 0 });
    totals.marginPct = totals.revenue > 0 ? Number(((totals.profit / totals.revenue) * 100).toFixed(2)) : 0;
    res.json({ data, totals });
  } catch (err) { next(err); }
});

// GET /api/reports/gst-summary - GSTR-1 like outward summary by HSN + rate
router.get('/gst-summary', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) where.invoiceDate = {};
    if (from) where.invoiceDate.gte = new Date(from);
    if (to) where.invoiceDate.lte = new Date(to);
    where.status = { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'FULLY_PAID', 'OVERDUE'] };

    const invoices = await prisma.invoice.findMany({
      where,
      include: { items: { include: { product: { select: { hsnCode: true, name: true } } } } },
    });

    const hsnMap = new Map();
    let totals = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, grand: 0 };

    invoices.forEach((inv) => {
      totals.cgst += parseFloat(inv.cgstAmount || 0);
      totals.sgst += parseFloat(inv.sgstAmount || 0);
      totals.igst += parseFloat(inv.igstAmount || 0);
      totals.cess += parseFloat(inv.cessAmount || 0);
      totals.grand += parseFloat(inv.grandTotal);
      inv.items.forEach((it) => {
        const hsn = it.product.hsnCode || '—';
        const rate = parseFloat(it.taxRate);
        const key = `${hsn}|${rate}`;
        const taxable = parseFloat(it.unitPrice) * parseFloat(it.quantity) - parseFloat(it.discount || 0);
        const tax = parseFloat(it.taxAmount);
        const cur = hsnMap.get(key) || { hsn, rate, taxable: 0, tax: 0, qty: 0 };
        cur.taxable += taxable; cur.tax += tax; cur.qty += parseFloat(it.quantity);
        hsnMap.set(key, cur);
      });
    });
    totals.taxable = Array.from(hsnMap.values()).reduce((s, r) => s + r.taxable, 0);

    res.json({ hsnSummary: Array.from(hsnMap.values()).sort((a, b) => b.taxable - a.taxable), totals, invoiceCount: invoices.length });
  } catch (err) { next(err); }
});

// GET /api/reports/supplier-performance
router.get('/supplier-performance', authenticate, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: { supplier: { select: { name: true } }, grns: { select: { receivedDate: true } } },
    });

    const map = new Map();
    pos.forEach((po) => {
      const key = po.supplierId;
      const cur = map.get(key) || { supplierId: key, name: po.supplier.name, totalPOs: 0, totalValue: 0, fulfilled: 0, onTime: 0, avgDeliveryDays: 0, totalDeliveryDays: 0, deliveryCount: 0 };
      cur.totalPOs += 1;
      cur.totalValue += parseFloat(po.grandTotal);
      if (po.status === 'FULLY_RECEIVED' || po.status === 'CLOSED') cur.fulfilled += 1;
      if (po.grns.length > 0) {
        const firstGRN = new Date(po.grns[0].receivedDate);
        const created = new Date(po.createdAt);
        const days = Math.max(0, Math.floor((firstGRN - created) / (1000 * 60 * 60 * 24)));
        cur.totalDeliveryDays += days;
        cur.deliveryCount += 1;
        if (po.expectedDeliveryDate && firstGRN <= new Date(po.expectedDeliveryDate)) cur.onTime += 1;
      }
      map.set(key, cur);
    });

    const data = Array.from(map.values()).map((r) => ({
      ...r,
      fulfillmentRate: r.totalPOs > 0 ? Number(((r.fulfilled / r.totalPOs) * 100).toFixed(1)) : 0,
      onTimeRate: r.deliveryCount > 0 ? Number(((r.onTime / r.deliveryCount) * 100).toFixed(1)) : 0,
      avgDeliveryDays: r.deliveryCount > 0 ? Number((r.totalDeliveryDays / r.deliveryCount).toFixed(1)) : 0,
    })).sort((a, b) => b.totalValue - a.totalValue);

    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/reports/stock-aging - bucketed by days since last receipt
router.get('/stock-aging', authenticate, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', currentStock: { gt: 0 } },
      include: { stockLedgerEntries: { where: { movementType: { in: ['PURCHASE_RECEIPT', 'OPENING_STOCK'] } }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const today = new Date();
    const buckets = { d30: 0, d60: 0, d90: 0, d180: 0, d180p: 0, totalValue: 0 };
    const data = products.map((p) => {
      const last = p.stockLedgerEntries[0]?.createdAt;
      const lastDate = last ? new Date(last) : new Date(p.createdAt);
      const days = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      const value = parseFloat(p.currentStock) * parseFloat(p.costPrice);
      const bucket = days <= 30 ? 'd30' : days <= 60 ? 'd60' : days <= 90 ? 'd90' : days <= 180 ? 'd180' : 'd180p';
      buckets[bucket] += value;
      buckets.totalValue += value;
      return { id: p.id, name: p.name, sku: p.sku, currentStock: parseFloat(p.currentStock), value, daysOld: days, bucket };
    }).sort((a, b) => b.daysOld - a.daysOld);

    res.json({ data, buckets });
  } catch (err) { next(err); }
});

module.exports = router;
