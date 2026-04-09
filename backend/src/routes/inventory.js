const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// GET /api/inventory/stock-summary
router.get('/stock-summary', authenticate, async (req, res, next) => {
  try {
    const { search, categoryId, stockStatus, page = 1, limit = 20 } = req.query;
    const where = { status: 'ACTIVE' };
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
    if (categoryId) where.categoryId = categoryId;

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    // Add stock status
    let filtered = products.map(p => {
      let status = 'IN_STOCK';
      if (parseFloat(p.currentStock) === 0) status = 'OUT_OF_STOCK';
      else if (parseFloat(p.currentStock) <= parseFloat(p.reorderLevel)) status = 'LOW_STOCK';
      return { ...p, stockStatus: status };
    });

    if (stockStatus) {
      filtered = filtered.filter(p => p.stockStatus === stockStatus);
    }

    const total = filtered.length;
    const paginated = filtered.slice((parseInt(page) - 1) * parseInt(limit), parseInt(page) * parseInt(limit));

    res.json({ data: paginated, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/inventory/ledger
router.get('/ledger', authenticate, async (req, res, next) => {
  try {
    const { productId, movementType, page = 1, limit = 50 } = req.query;
    const where = {};
    if (productId) where.productId = productId;
    if (movementType) where.movementType = movementType;

    const [entries, total] = await Promise.all([
      prisma.stockLedgerEntry.findMany({
        where,
        include: { product: { select: { name: true, sku: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.stockLedgerEntry.count({ where }),
    ]);

    res.json({ data: entries, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// POST /api/inventory/adjustment — Stock adjustment
router.post('/adjustment', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), [
  body('productId').notEmpty(),
  body('adjustmentType').isIn(['OPENING_STOCK', 'PHYSICAL_COUNT', 'DAMAGE_WRITEOFF', 'TRANSFER']),
  body('quantity').isNumeric(),
  body('reason').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { productId, adjustmentType, quantity, reason, unitCost, warehouse } = req.body;
    const qty = parseFloat(quantity);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const currentStock = parseFloat(product.currentStock);
    const newStock = adjustmentType === 'DAMAGE_WRITEOFF' ? currentStock - Math.abs(qty) : currentStock + qty;

    if (newStock < 0) return res.status(400).json({ error: 'Adjustment would result in negative stock.' });

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      const isIn = qty > 0 && adjustmentType !== 'DAMAGE_WRITEOFF';
      await tx.stockLedgerEntry.create({
        data: {
          productId,
          movementType: adjustmentType === 'OPENING_STOCK' ? 'OPENING_STOCK' :
            adjustmentType === 'DAMAGE_WRITEOFF' ? 'ADJUSTMENT' : 'ADJUSTMENT',
          referenceType: 'Adjustment',
          quantityIn: isIn ? Math.abs(qty) : null,
          quantityOut: !isIn ? Math.abs(qty) : null,
          balanceAfter: newStock,
          unitCost: unitCost ? parseFloat(unitCost) : parseFloat(product.costPrice),
          totalValue: Math.abs(qty) * parseFloat(product.costPrice),
          warehouse: warehouse || null,
          notes: reason,
          createdById: req.user.id,
        },
      });
    });

    await createAuditLog({
      userId: req.user.id,
      module: 'INVENTORY',
      action: 'ADJUSTMENT',
      recordId: productId,
      newValue: { adjustmentType, quantity, reason, newStock },
    });

    const updated = await prisma.product.findUnique({ where: { id: productId } });
    res.json({ message: 'Stock adjusted successfully.', product: updated });
  } catch (err) { next(err); }
});

// GET /api/inventory/valuation
router.get('/valuation', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER', 'PROCUREMENT_MANAGER'), async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', currentStock: { gt: 0 } },
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    let totalValue = 0;
    const data = products.map(p => {
      const value = parseFloat(p.currentStock) * parseFloat(p.costPrice);
      totalValue += value;
      return { ...p, stockValue: value };
    });

    res.json({ data, totalValue });
  } catch (err) { next(err); }
});

module.exports = router;
