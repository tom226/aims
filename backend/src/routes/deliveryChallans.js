const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { generateDocNumber } = require('../utils/docNumber');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, customerId, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (search) where.challanNumber = { contains: search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      prisma.deliveryChallan.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.deliveryChallan.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const c = await prisma.deliveryChallan.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALESPERSON'), async (req, res, next) => {
  try {
    const { customerId, challanDate, vehicleNumber, driverName, driverPhone, transporter, shippingAddress, notes, items } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer is required' });
    if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });

    const challanNumber = await generateDocNumber(prisma, 'DC', 'challanNumber', 'deliveryChallan');

    const created = await prisma.deliveryChallan.create({
      data: {
        challanNumber, customerId,
        challanDate: challanDate ? new Date(challanDate) : new Date(),
        vehicleNumber, driverName, driverPhone, transporter, shippingAddress, notes,
        status: 'DRAFT',
        createdById: req.user.id,
        items: { create: items.map(i => ({ productId: i.productId, quantity: parseFloat(i.quantity), notes: i.notes })) },
      },
      include: { items: true },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

router.post('/:id/dispatch', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALESPERSON'), async (req, res, next) => {
  try {
    const c = await prisma.deliveryChallan.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'DRAFT') return res.status(400).json({ error: `Cannot dispatch in status ${c.status}` });
    const updated = await prisma.deliveryChallan.update({ where: { id: c.id }, data: { status: 'DISPATCHED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/deliver', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALESPERSON'), async (req, res, next) => {
  try {
    const c = await prisma.deliveryChallan.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'DISPATCHED') return res.status(400).json({ error: 'Challan must be DISPATCHED first' });
    const updated = await prisma.deliveryChallan.update({ where: { id: c.id }, data: { status: 'DELIVERED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'SALESPERSON'), async (req, res, next) => {
  try {
    const c = await prisma.deliveryChallan.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status === 'DELIVERED') return res.status(400).json({ error: 'Cannot cancel a delivered challan' });
    const updated = await prisma.deliveryChallan.update({ where: { id: c.id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
