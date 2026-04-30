const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { generateDocNumber } = require('../utils/docNumber');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, supplierId, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (search) where.returnNumber = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      prisma.purchaseReturn.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.purchaseReturn.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const r = await prisma.purchaseReturn.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const { supplierId, returnDate, reason, notes, items } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'Supplier is required' });
    if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });

    const returnNumber = await generateDocNumber(prisma, 'DN', 'returnNumber', 'purchaseReturn');

    let subTotal = 0, taxAmount = 0;
    const itemRows = items.map((i) => {
      const lineSub = parseFloat(i.unitPrice) * parseFloat(i.quantity);
      const lineTax = (lineSub * parseFloat(i.taxRate || 0)) / 100;
      subTotal += lineSub;
      taxAmount += lineTax;
      return {
        productId: i.productId,
        quantity: parseFloat(i.quantity),
        unitPrice: parseFloat(i.unitPrice),
        taxRate: parseFloat(i.taxRate || 0),
        taxAmount: lineTax,
        total: lineSub + lineTax,
      };
    });

    const created = await prisma.purchaseReturn.create({
      data: {
        returnNumber, supplierId,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        reason, notes, status: 'DRAFT',
        subTotal, taxAmount, grandTotal: subTotal + taxAmount,
        createdById: req.user.id,
        items: { create: itemRows },
      },
      include: { items: true },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// Confirm: decrement stock + log
router.post('/:id/confirm', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const r = await prisma.purchaseReturn.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: true } } } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status !== 'DRAFT') return res.status(400).json({ error: `Cannot confirm in status ${r.status}` });

    // Validate stock
    for (const it of r.items) {
      if (parseFloat(it.product.currentStock) < parseFloat(it.quantity)) {
        return res.status(400).json({ error: `Insufficient stock for ${it.product.name}. Available: ${it.product.currentStock}` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const it of r.items) {
        const p = await tx.product.update({
          where: { id: it.productId },
          data: { currentStock: { decrement: it.quantity } },
          select: { currentStock: true, costPrice: true },
        });
        await tx.stockLedgerEntry.create({
          data: {
            productId: it.productId,
            movementType: 'RETURN_OUT',
            referenceType: 'PurchaseReturn',
            referenceId: r.id,
            quantityOut: it.quantity,
            balanceAfter: p.currentStock,
            unitCost: p.costPrice,
            totalValue: parseFloat(p.costPrice) * parseFloat(it.quantity),
            notes: `Purchase return ${r.returnNumber}`,
            createdById: req.user.id,
          },
        });
      }
      return tx.purchaseReturn.update({ where: { id: r.id }, data: { status: 'CONFIRMED' } });
    });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const r = await prisma.purchaseReturn.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status === 'CONFIRMED') return res.status(400).json({ error: 'Cannot cancel a confirmed return' });
    const updated = await prisma.purchaseReturn.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
