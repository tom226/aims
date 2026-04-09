const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

const SUPPLIER_ROLES = ['SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'FINANCE_MANAGER'];

// GET /api/suppliers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { gstin: { contains: search, mode: 'insensitive' } }];
    if (status) where.status = status;

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { _count: { select: { purchaseOrders: true } } },
      }),
      prisma.supplier.count({ where }),
    ]);
    res.json({ data: suppliers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/suppliers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const supplier = await prisma.supplier.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, poNumber: true, status: true, grandTotal: true, createdAt: true },
        },
      },
    });
    res.json(supplier);
  } catch (err) { next(err); }
});

// POST /api/suppliers
router.post('/', authenticate, authorize(...SUPPLIER_ROLES), [
  body('name').notEmpty().trim(),
  body('email').optional().isEmail(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, contactPerson, email, phone, gstin, billingAddress, shippingAddress,
      paymentTerms, bankDetails, status, category, notes } = req.body;

    // Check for duplicate GSTIN
    if (gstin) {
      const existing = await prisma.supplier.findUnique({ where: { gstin } });
      if (existing) return res.status(409).json({ error: 'A supplier with this GSTIN already exists.' });
    }

    // Auto-generate supplier number
    const count = await prisma.supplier.count();
    const supplierNumber = `SUP-${String(count + 1).padStart(4, '0')}`;

    const supplier = await prisma.supplier.create({
      data: { supplierNumber, name, contactPerson, email, phone, gstin, billingAddress, shippingAddress, paymentTerms: paymentTerms || 'Net 30', bankDetails, status: status || 'ACTIVE', category, notes },
    });

    await createAuditLog({ userId: req.user.id, module: 'SUPPLIERS', action: 'CREATE', recordId: supplier.id, newValue: { name, gstin } });
    res.status(201).json(supplier);
  } catch (err) { next(err); }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticate, authorize(...SUPPLIER_ROLES), async (req, res, next) => {
  try {
    const old = await prisma.supplier.findUniqueOrThrow({ where: { id: req.params.id } });
    const { name, contactPerson, email, phone, gstin, billingAddress, shippingAddress,
      paymentTerms, bankDetails, status, category, notes } = req.body;

    // Check for duplicate GSTIN (excluding self)
    if (gstin && gstin !== old.gstin) {
      const existing = await prisma.supplier.findUnique({ where: { gstin } });
      if (existing) return res.status(409).json({ error: 'A supplier with this GSTIN already exists.' });
    }

    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: { name, contactPerson, email, phone, gstin, billingAddress, shippingAddress, paymentTerms, bankDetails, status, category, notes },
    });

    await createAuditLog({ userId: req.user.id, module: 'SUPPLIERS', action: 'UPDATE', recordId: supplier.id, oldValue: old, newValue: supplier });
    res.json(supplier);
  } catch (err) { next(err); }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const pos = await prisma.purchaseOrder.count({ where: { supplierId: req.params.id } });
    if (pos > 0) return res.status(400).json({ error: 'Cannot delete supplier with existing purchase orders. Deactivate it instead.' });

    await prisma.supplier.delete({ where: { id: req.params.id } });
    await createAuditLog({ userId: req.user.id, module: 'SUPPLIERS', action: 'DELETE', recordId: req.params.id });
    res.json({ message: 'Supplier deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
