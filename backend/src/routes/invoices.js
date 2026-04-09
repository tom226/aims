const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { generateDocNumber } = require('../utils/docNumber');

// GET /api/invoices
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, customerId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [{ invoiceNumber: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          linkedPo: { select: { poNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    // Add computed balance due
    const data = invoices.map(inv => ({
      ...inv,
      balanceDue: parseFloat(inv.grandTotal) - parseFloat(inv.amountPaid),
    }));

    res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        linkedPo: { include: { supplier: true } },
        salesOrder: { select: { soNumber: true } },
        items: { include: { product: true, poItem: true } },
      },
    });
    res.json({
      ...invoice,
      balanceDue: parseFloat(invoice.grandTotal) - parseFloat(invoice.amountPaid),
    });
  } catch (err) { next(err); }
});

// POST /api/invoices — Create invoice (fresh, from SO, or from PO)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), [
  body('customerId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').notEmpty(),
  body('items.*.quantity').isNumeric({ min: 0.001 }),
  body('items.*.unitPrice').isNumeric({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { customerId, salesOrderId, linkedPoId, invoiceDate, dueDate,
      shippingCharges, notes, items } = req.body;

    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    if (customer.status === 'ON_HOLD') {
      return res.status(400).json({ error: 'Customer is on credit hold.' });
    }

    // Validate stock for each item
    for (const item of items) {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
      const available = parseFloat(product.currentStock) - parseFloat(product.reservedStock);
      if (available < parseFloat(item.quantity)) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${available}`,
        });
      }
    }

    // If linked to PO, validate quantities against GRN
    if (linkedPoId) {
      const po = await prisma.purchaseOrder.findUniqueOrThrow({
        where: { id: linkedPoId },
        include: { items: true },
      });
      if (!['FULLY_RECEIVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        return res.status(400).json({ error: 'Linked PO must have received goods (GRN confirmed).' });
      }
    }

    const invoiceNumber = await generateDocNumber(prisma, 'INV', 'invoiceNumber', 'invoice');

    let subTotal = 0, discountAmount = 0, taxAmount = 0;
    const itemData = items.map(item => {
      const itemSubTotal = parseFloat(item.unitPrice) * parseFloat(item.quantity);
      const itemDiscount = parseFloat(item.discount || 0);
      const taxable = itemSubTotal - itemDiscount;
      const itemTax = taxable * (parseFloat(item.taxRate || 0) / 100);
      subTotal += itemSubTotal;
      discountAmount += itemDiscount;
      taxAmount += itemTax;
      return {
        productId: item.productId,
        poItemId: item.poItemId || null,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        costPrice: parseFloat(item.costPrice || 0),
        discount: parseFloat(item.discount || 0),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: itemTax,
        total: taxable + itemTax,
      };
    });

    const grandTotal = subTotal - discountAmount + taxAmount + parseFloat(shippingCharges || 0);

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          customerId,
          salesOrderId: salesOrderId || null,
          linkedPoId: linkedPoId || null,
          createdById: req.user.id,
          status: 'ISSUED',
          subTotal,
          discountAmount,
          taxAmount,
          shippingCharges: parseFloat(shippingCharges || 0),
          grandTotal,
          items: { create: itemData },
        },
      });

      // Decrement stock permanently
      for (const item of items) {
        const qty = parseFloat(item.quantity);
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: qty },
            // If coming from SO, also release reservation
            ...(salesOrderId && { reservedStock: { decrement: qty } }),
          },
        });

        // Create stock ledger entry
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        await tx.stockLedgerEntry.create({
          data: {
            productId: item.productId,
            movementType: 'SALE',
            referenceType: 'Invoice',
            referenceId: inv.id,
            quantityOut: qty,
            balanceAfter: parseFloat(product.currentStock),
            unitCost: parseFloat(item.costPrice || item.unitPrice),
            totalValue: qty * parseFloat(item.unitPrice),
            createdById: req.user.id,
          },
        });
      }

      // Update customer outstanding balance
      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingBalance: { increment: grandTotal } },
      });

      // Update SO status if linked
      if (salesOrderId) {
        const soInvoices = await tx.invoice.findMany({
          where: { salesOrderId, status: { not: 'CANCELLED' } },
        });
        await tx.salesOrder.update({
          where: { id: salesOrderId },
          data: { status: soInvoices.length >= 1 ? 'FULLY_INVOICED' : 'PARTIALLY_INVOICED' },
        });
      }

      return inv;
    });

    await createAuditLog({ userId: req.user.id, module: 'INVOICES', action: 'CREATE', recordId: invoice.id });

    const fullInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { customer: true, items: { include: { product: true } }, linkedPo: true },
    });

    res.status(201).json({ ...fullInvoice, balanceDue: parseFloat(fullInvoice.grandTotal) - parseFloat(fullInvoice.amountPaid) });
  } catch (err) { next(err); }
});

// POST /api/invoices/:id/record-payment
router.post('/:id/record-payment', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER'), [
  body('amount').isNumeric({ min: 0.01 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: req.params.id } });
    const { amount } = req.body;
    const newAmountPaid = parseFloat(invoice.amountPaid) + parseFloat(amount);
    const balanceDue = parseFloat(invoice.grandTotal) - newAmountPaid;

    const status = balanceDue <= 0 ? 'FULLY_PAID' : 'PARTIALLY_PAID';

    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: newAmountPaid, status },
      });
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { outstandingBalance: { decrement: parseFloat(amount) } },
      });
      return inv;
    });

    await createAuditLog({ userId: req.user.id, module: 'INVOICES', action: 'PAYMENT', recordId: invoice.id, newValue: { amount } });
    res.json({ ...updated, balanceDue: parseFloat(updated.grandTotal) - parseFloat(updated.amountPaid) });
  } catch (err) { next(err); }
});

// PATCH /api/invoices/:id/cancel
router.patch('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (['FULLY_PAID', 'CANCELLED'].includes(invoice.status)) {
      return res.status(400).json({ error: `Cannot cancel invoice with status: ${invoice.status}` });
    }

    await prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of invoice.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: parseFloat(item.quantity) } },
        });
        await tx.stockLedgerEntry.create({
          data: {
            productId: item.productId,
            movementType: 'RETURN_IN',
            referenceType: 'Invoice',
            referenceId: invoice.id,
            quantityIn: parseFloat(item.quantity),
            balanceAfter: 0, // Will be stale, but logged
            unitCost: parseFloat(item.costPrice || item.unitPrice),
            totalValue: parseFloat(item.quantity) * parseFloat(item.unitPrice),
            createdById: req.user.id,
          },
        });
      }

      // Reduce customer outstanding
      const unpaid = parseFloat(invoice.grandTotal) - parseFloat(invoice.amountPaid);
      await tx.customer.update({
        where: { id: invoice.customerId },
        data: { outstandingBalance: { decrement: unpaid } },
      });

      await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'CANCELLED' } });
    });

    await createAuditLog({ userId: req.user.id, module: 'INVOICES', action: 'CANCEL', recordId: invoice.id });
    res.json({ message: 'Invoice cancelled and stock restored.' });
  } catch (err) { next(err); }
});

module.exports = router;
