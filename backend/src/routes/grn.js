const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { generateDocNumber } = require('../utils/docNumber');

// GET /api/grn
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { poId, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (poId) where.poId = poId;
    if (status) where.status = status;

    const [grns, total] = await Promise.all([
      prisma.goodsReceiptNote.findMany({
        where,
        include: {
          purchaseOrder: { select: { poNumber: true, supplier: { select: { name: true } } } },
          items: { include: { poItem: { include: { product: { select: { name: true, sku: true } } } } } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.goodsReceiptNote.count({ where }),
    ]);
    res.json({ data: grns, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/grn/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const grn = await prisma.goodsReceiptNote.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        purchaseOrder: { include: { supplier: true } },
        items: { include: { poItem: { include: { product: true } } } },
        createdBy: { select: { name: true } },
      },
    });
    res.json(grn);
  } catch (err) { next(err); }
});

// POST /api/grn — Create and confirm a GRN
router.post('/', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'PROCUREMENT_MANAGER'), [
  body('poId').notEmpty(),
  body('items').isArray({ min: 1 }),
  body('items.*.poItemId').notEmpty(),
  body('items.*.quantityReceived').isNumeric({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { poId, items, notes, receivedDate } = req.body;

    // Validate PO is in receivable state
    const po = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: poId },
      include: { items: true },
    });

    const receivableStatuses = ['APPROVED', 'SENT', 'PARTIALLY_RECEIVED'];
    if (!receivableStatuses.includes(po.status)) {
      return res.status(400).json({ error: `Cannot receive goods against a PO with status: ${po.status}` });
    }

    const grnNumber = await generateDocNumber(prisma, 'GRN', 'grnNumber', 'goodsReceiptNote');

    // Validate quantities don't exceed ordered quantities
    for (const item of items) {
      const poItem = po.items.find(i => i.id === item.poItemId);
      if (!poItem) return res.status(400).json({ error: `PO item ${item.poItemId} not found.` });
      const totalReceived = parseFloat(poItem.quantityReceived) + parseFloat(item.quantityReceived);
      if (totalReceived > parseFloat(poItem.quantityOrdered) && !item.overrideFlag) {
        return res.status(400).json({
          error: `Received quantity exceeds ordered quantity for item ${poItem.id}. Set overrideFlag to proceed.`,
        });
      }
    }

    // Create GRN and update stock in a transaction
    const grn = await prisma.$transaction(async (tx) => {
      const grnRecord = await tx.goodsReceiptNote.create({
        data: {
          grnNumber,
          poId,
          status: 'CONFIRMED',
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          notes,
          createdById: req.user.id,
          items: {
            create: items.map(item => ({
              poItemId: item.poItemId,
              quantityReceived: parseFloat(item.quantityReceived),
              batchNumber: item.batchNumber || null,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              qualityStatus: item.qualityStatus || 'PASS',
              notes: item.notes || null,
            })),
          },
        },
      });

      // Update PO item quantities received and product stock
      for (const item of items) {
        const poItem = po.items.find(i => i.id === item.poItemId);
        const qty = parseFloat(item.quantityReceived);
        if (qty <= 0) continue;

        // Update PO item received qty
        await tx.purchaseOrderItem.update({
          where: { id: item.poItemId },
          data: { quantityReceived: { increment: qty } },
        });

        // Update product stock
        await tx.product.update({
          where: { id: poItem.productId },
          data: {
            currentStock: { increment: qty },
            costPrice: parseFloat(poItem.unitPrice), // Update cost price to latest PO price
          },
        });

        // Create stock ledger entry
        const product = await tx.product.findUnique({ where: { id: poItem.productId } });
        await tx.stockLedgerEntry.create({
          data: {
            productId: poItem.productId,
            movementType: 'PURCHASE_RECEIPT',
            referenceType: 'GRN',
            referenceId: grnRecord.id,
            quantityIn: qty,
            balanceAfter: parseFloat(product.currentStock),
            unitCost: parseFloat(poItem.unitPrice),
            totalValue: qty * parseFloat(poItem.unitPrice),
            createdById: req.user.id,
          },
        });
      }

      // Determine new PO status
      const updatedPOItems = await tx.purchaseOrderItem.findMany({ where: { poId } });
      const allReceived = updatedPOItems.every(i => parseFloat(i.quantityReceived) >= parseFloat(i.quantityOrdered));
      const anyReceived = updatedPOItems.some(i => parseFloat(i.quantityReceived) > 0);

      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: allReceived ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status },
      });

      return grnRecord;
    });

    await createAuditLog({ userId: req.user.id, module: 'GRN', action: 'CREATE', recordId: grn.id });
    
    // Fetch full GRN with relations
    const fullGrn = await prisma.goodsReceiptNote.findUnique({
      where: { id: grn.id },
      include: {
        purchaseOrder: { include: { supplier: true } },
        items: { include: { poItem: { include: { product: true } } } },
      },
    });

    res.status(201).json(fullGrn);
  } catch (err) { next(err); }
});

module.exports = router;
