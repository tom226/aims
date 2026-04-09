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

module.exports = router;
