const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// GET /api/customers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { gstin: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
    if (status) where.status = status;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: { _count: { select: { invoices: true } } },
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ data: customers, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/customers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, invoiceNumber: true, status: true, grandTotal: true, balanceDue: true, dueDate: true },
        },
      },
    });
    res.json(customer);
  } catch (err) { next(err); }
});

// POST /api/customers
router.post('/', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), [
  body('name').notEmpty().trim(),
  body('email').optional().isEmail(),
  body('creditLimit').optional().isNumeric(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, contactPerson, email, phone, gstin, pan, billingAddress, shippingAddress,
      paymentTerms, creditLimit, customerType, status, notes } = req.body;

    const count = await prisma.customer.count();
    const customerNumber = `CUST-${String(count + 1).padStart(4, '0')}`;

    const customer = await prisma.customer.create({
      data: {
        customerNumber, name, contactPerson, email, phone, gstin, pan,
        billingAddress, shippingAddress,
        paymentTerms: paymentTerms || 'Net 30',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        customerType: customerType || 'RETAIL',
        status: status || 'ACTIVE',
        notes,
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'CUSTOMERS', action: 'CREATE', recordId: customer.id });
    res.status(201).json(customer);
  } catch (err) { next(err); }
});

// PUT /api/customers/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'SALESPERSON', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const old = await prisma.customer.findUniqueOrThrow({ where: { id: req.params.id } });
    const { name, contactPerson, email, phone, gstin, pan, billingAddress, shippingAddress,
      paymentTerms, creditLimit, customerType, status, notes } = req.body;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name, contactPerson, email, phone, gstin, pan, billingAddress, shippingAddress,
        paymentTerms, creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        customerType, status, notes,
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'CUSTOMERS', action: 'UPDATE', recordId: customer.id, oldValue: old });
    res.json(customer);
  } catch (err) { next(err); }
});

module.exports = router;
