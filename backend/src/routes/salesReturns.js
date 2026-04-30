const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { generateDocNumber } = require('../utils/docNumber');

// GET /api/sales-returns
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, customerId, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) where.returnNumber = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          invoice: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.salesReturn.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const r = await prisma.salesReturn.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        invoice: { select: { invoiceNumber: true, invoiceDate: true } },
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const { customerId, invoiceId, returnDate, reason, notes, items } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer is required' });
    if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });

    const returnNumber = await generateDocNumber(prisma, 'CN', 'returnNumber', 'salesReturn');

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

    const created = await prisma.salesReturn.create({
      data: {
        returnNumber, customerId, invoiceId: invoiceId || null,
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

// Confirm return: increment stock + log
router.post('/:id/confirm', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const r = await prisma.salesReturn.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status !== 'DRAFT') return res.status(400).json({ error: `Cannot confirm in status ${r.status}` });

    const updated = await prisma.$transaction(async (tx) => {
      for (const it of r.items) {
        const p = await tx.product.update({
          where: { id: it.productId },
          data: { currentStock: { increment: it.quantity } },
          select: { currentStock: true, costPrice: true },
        });
        await tx.stockLedgerEntry.create({
          data: {
            productId: it.productId,
            movementType: 'RETURN_IN',
            referenceType: 'SalesReturn',
            referenceId: r.id,
            quantityIn: it.quantity,
            balanceAfter: p.currentStock,
            unitCost: p.costPrice,
            totalValue: parseFloat(p.costPrice) * parseFloat(it.quantity),
            notes: `Sales return ${r.returnNumber}`,
            createdById: req.user.id,
          },
        });
      }
      return tx.salesReturn.update({ where: { id: r.id }, data: { status: 'CONFIRMED' } });
    });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const r = await prisma.salesReturn.findUnique({ where: { id: req.params.id } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status === 'CONFIRMED') return res.status(400).json({ error: 'Cannot cancel a confirmed return' });
    const updated = await prisma.salesReturn.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
