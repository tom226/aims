const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/warehouses
router.get('/', authenticate, async (req, res, next) => {
  try {
    const data = await prisma.warehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { stock: true } } },
    });
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
});

// GET /api/warehouses/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const wh = await prisma.warehouse.findUnique({
      where: { id: req.params.id },
      include: {
        stock: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } }, orderBy: { product: { name: 'asc' } } },
      },
    });
    if (!wh) return res.status(404).json({ error: 'Warehouse not found' });
    res.json(wh);
  } catch (err) { next(err); }
});

// POST /api/warehouses
router.post('/', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const { code, name, address, stateCode, isDefault } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Code and name are required' });

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.warehouse.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.warehouse.create({
        data: { code: code.toUpperCase().trim(), name, address, stateCode, isDefault: !!isDefault },
      });
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Warehouse code already exists' });
    next(err);
  }
});

// PUT /api/warehouses/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const { name, address, stateCode, isDefault, isActive } = req.body;
    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.warehouse.updateMany({ where: { isDefault: true, id: { not: req.params.id } }, data: { isDefault: false } });
      }
      return tx.warehouse.update({
        where: { id: req.params.id },
        data: { name, address, stateCode, isDefault, isActive },
      });
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/warehouses/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const wh = await prisma.warehouse.findUnique({ where: { id: req.params.id }, include: { _count: { select: { stock: true, transfersFrom: true, transfersTo: true } } } });
    if (!wh) return res.status(404).json({ error: 'Not found' });
    if (wh._count.transfersFrom > 0 || wh._count.transfersTo > 0) {
      return res.status(400).json({ error: 'Cannot delete: warehouse has transfer history. Mark inactive instead.' });
    }
    await prisma.warehouse.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
