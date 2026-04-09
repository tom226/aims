const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { generateDocNumber } = require('../utils/docNumber');

// GET /api/sales-orders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, customerId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [{ soNumber: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [sos, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.salesOrder.count({ where }),
    ]);
    res.json({ data: sos, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/sales-orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const so = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true, reservedStock: true } } } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, grandTotal: true } },
      },
    });
    res.json(so);
  } catch (err) { next(err); }
});

// POST /api/sales-orders
router.post('/', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON'), [
  body('customerId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').notEmpty(),
  body('items.*.quantity').isNumeric({ min: 0.001 }),
  body('items.*.unitPrice').isNumeric({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { customerId, deliveryDate, shippingAddress, paymentTerms, customerPoRef, notes, items } = req.body;

    // Check customer credit
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (customer.status === 'ON_HOLD') {
      return res.status(400).json({ error: 'Customer is on credit hold.' });
    }

    // Validate stock availability
    for (const item of items) {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
      const available = parseFloat(product.currentStock) - parseFloat(product.reservedStock);
      if (available < parseFloat(item.quantity)) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${available} ${product.unit}`,
        });
      }
    }

    const soNumber = await generateDocNumber(prisma, 'SO', 'soNumber', 'salesOrder');

    let subTotal = 0, discountAmount = 0, taxAmount = 0;
    const itemData = items.map(item => {
      const itemSubTotal = parseFloat(item.unitPrice) * parseFloat(item.quantity);
      const itemDiscount = itemSubTotal * (parseFloat(item.discount || 0) / 100);
      const taxable = itemSubTotal - itemDiscount;
      const itemTax = taxable * (parseFloat(item.taxRate || 0) / 100);
      subTotal += itemSubTotal;
      discountAmount += itemDiscount;
      taxAmount += itemTax;
      return {
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        discount: parseFloat(item.discount || 0),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: itemTax,
        total: taxable + itemTax,
      };
    });

    const grandTotal = subTotal - discountAmount + taxAmount;

    const so = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          soNumber,
          customerId,
          status: 'CONFIRMED',
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          shippingAddress,
          paymentTerms,
          customerPoRef,
          notes,
          subTotal,
          discountAmount,
          taxAmount,
          grandTotal,
          createdById: req.user.id,
          items: { create: itemData },
        },
      });

      // Reserve stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { increment: parseFloat(item.quantity) } },
        });
      }

      return order;
    });

    await createAuditLog({ userId: req.user.id, module: 'SALES_ORDERS', action: 'CREATE', recordId: so.id });
    
    const fullSO = await prisma.salesOrder.findUnique({
      where: { id: so.id },
      include: { customer: true, items: { include: { product: true } } },
    });
    res.status(201).json(fullSO);
  } catch (err) { next(err); }
});

// PATCH /api/sales-orders/:id/cancel
router.patch('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON'), async (req, res, next) => {
  try {
    const so = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (['FULLY_INVOICED', 'CLOSED', 'CANCELLED'].includes(so.status)) {
      return res.status(400).json({ error: `Cannot cancel SO with status: ${so.status}` });
    }

    await prisma.$transaction(async (tx) => {
      // Release reserved stock
      for (const item of so.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedStock: { decrement: parseFloat(item.quantity) } },
        });
      }
      await tx.salesOrder.update({ where: { id: so.id }, data: { status: 'CANCELLED' } });
    });

    await createAuditLog({ userId: req.user.id, module: 'SALES_ORDERS', action: 'CANCEL', recordId: so.id });
    res.json({ message: 'Sales order cancelled.' });
  } catch (err) { next(err); }
});

module.exports = router;
