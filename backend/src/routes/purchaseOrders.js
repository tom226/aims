const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { generateDocNumber } = require('../utils/docNumber');

const PO_WRITE_ROLES = ['SUPER_ADMIN', 'PROCUREMENT_MANAGER'];

// GET /api/purchase-orders
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, supplierId, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [{ poNumber: { contains: search, mode: 'insensitive' } }];
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    }
    if (supplierId) where.supplierId = supplierId;

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    res.json({ data: pos, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/purchase-orders/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        supplier: true,
        createdBy: { select: { name: true, email: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, unit: true, currentStock: true } } },
        },
        grns: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    res.json(po);
  } catch (err) { next(err); }
});

// POST /api/purchase-orders (create draft)
router.post('/', authenticate, authorize(...PO_WRITE_ROLES), [
  body('supplierId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.productId').notEmpty(),
  body('items.*.quantityOrdered').isNumeric({ min: 0.001 }),
  body('items.*.unitPrice').isNumeric({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { supplierId, expectedDeliveryDate, deliveryLocation, paymentTerms,
      shippingTerms, additionalCharges, notes, items } = req.body;

    const poNumber = await generateDocNumber(prisma, 'PO', 'poNumber', 'purchaseOrder');

    // Calculate totals
    let subTotal = 0, taxAmount = 0;
    const itemData = items.map(item => {
      const itemSubTotal = parseFloat(item.unitPrice) * parseFloat(item.quantityOrdered);
      const itemTax = itemSubTotal * (parseFloat(item.taxRate || 0) / 100);
      const total = itemSubTotal + itemTax;
      subTotal += itemSubTotal;
      taxAmount += itemTax;
      return {
        productId: item.productId,
        quantityOrdered: parseFloat(item.quantityOrdered),
        unitPrice: parseFloat(item.unitPrice),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: itemTax,
        total,
        notes: item.notes || null,
      };
    });

    const grandTotal = subTotal + taxAmount + parseFloat(additionalCharges || 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        status: 'DRAFT',
        createdById: req.user.id,
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        deliveryLocation,
        paymentTerms,
        shippingTerms,
        subTotal,
        taxAmount,
        additionalCharges: parseFloat(additionalCharges || 0),
        grandTotal,
        notes,
        items: { create: itemData },
      },
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'PURCHASE_ORDERS', action: 'CREATE', recordId: po.id });
    res.status(201).json(po);
  } catch (err) { next(err); }
});

// PATCH /api/purchase-orders/:id/status — Approve, Send, Cancel
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status transition.' });

    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: req.params.id } });

    // Role checks
    if (status === 'APPROVED' && !['SUPER_ADMIN', 'PROCUREMENT_MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Procurement Manager can approve POs.' });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === 'APPROVED' && { approvedById: req.user.id }),
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'PURCHASE_ORDERS', action: `STATUS_${status}`, recordId: po.id, oldValue: { status: po.status }, newValue: { status } });
    res.json(updated);
  } catch (err) { next(err); }
});

// PUT /api/purchase-orders/:id — Update draft PO
router.put('/:id', authenticate, authorize(...PO_WRITE_ROLES), async (req, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: req.params.id } });
    if (po.status !== 'DRAFT') return res.status(400).json({ error: 'Only Draft POs can be edited.' });

    const { supplierId, expectedDeliveryDate, deliveryLocation, paymentTerms,
      shippingTerms, additionalCharges, notes, items } = req.body;

    let subTotal = 0, taxAmount = 0;
    const itemData = (items || []).map(item => {
      const itemSubTotal = parseFloat(item.unitPrice) * parseFloat(item.quantityOrdered);
      const itemTax = itemSubTotal * (parseFloat(item.taxRate || 0) / 100);
      subTotal += itemSubTotal;
      taxAmount += itemTax;
      return {
        productId: item.productId,
        quantityOrdered: parseFloat(item.quantityOrdered),
        unitPrice: parseFloat(item.unitPrice),
        taxRate: parseFloat(item.taxRate || 0),
        taxAmount: itemTax,
        total: itemSubTotal + itemTax,
        notes: item.notes || null,
      };
    });

    const grandTotal = subTotal + taxAmount + parseFloat(additionalCharges || po.additionalCharges);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { poId: po.id } });
      return tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          supplierId: supplierId || po.supplierId,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : po.expectedDeliveryDate,
          deliveryLocation, paymentTerms, shippingTerms,
          subTotal, taxAmount,
          additionalCharges: parseFloat(additionalCharges || po.additionalCharges),
          grandTotal, notes,
          items: { create: itemData },
        },
        include: { supplier: true, items: { include: { product: true } } },
      });
    });

    await createAuditLog({ userId: req.user.id, module: 'PURCHASE_ORDERS', action: 'UPDATE', recordId: po.id });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
