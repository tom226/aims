const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { generateDocNumber } = require('../utils/docNumber');

// GET /api/stock-transfers
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) where.transferNumber = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromWarehouse: { select: { name: true, code: true } },
          toWarehouse: { select: { name: true, code: true } },
          createdBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.stockTransfer.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
});

// GET /api/stock-transfers/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const t = await prisma.stockTransfer.findUnique({
      where: { id: req.params.id },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        createdBy: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (err) { next(err); }
});

// POST /api/stock-transfers
router.post('/', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const { fromWarehouseId, toWarehouseId, transferDate, notes, items } = req.body;
    if (!fromWarehouseId || !toWarehouseId) return res.status(400).json({ error: 'Both warehouses are required' });
    if (fromWarehouseId === toWarehouseId) return res.status(400).json({ error: 'From and To warehouses must differ' });
    if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });

    const transferNumber = await generateDocNumber(prisma, 'TRF', 'transferNumber', 'stockTransfer');

    const created = await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId,
        toWarehouseId,
        transferDate: transferDate ? new Date(transferDate) : new Date(),
        notes,
        createdById: req.user.id,
        status: 'DRAFT',
        items: { create: items.map(i => ({ productId: i.productId, quantity: parseFloat(i.quantity) })) },
      },
      include: { items: true },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// POST /api/stock-transfers/:id/complete
router.post('/:id/complete', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: req.params.id },
      include: { items: true, fromWarehouse: true, toWarehouse: true },
    });
    if (!transfer) return res.status(404).json({ error: 'Not found' });
    if (transfer.status === 'COMPLETED') return res.status(400).json({ error: 'Already completed' });
    if (transfer.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot complete a cancelled transfer' });

    const result = await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Decrement source warehouse stock
        await tx.warehouseStock.upsert({
          where: { warehouseId_productId: { warehouseId: transfer.fromWarehouseId, productId: item.productId } },
          update: { quantity: { decrement: item.quantity } },
          create: { warehouseId: transfer.fromWarehouseId, productId: item.productId, quantity: 0 - parseFloat(item.quantity) },
        });
        // Increment destination warehouse stock
        await tx.warehouseStock.upsert({
          where: { warehouseId_productId: { warehouseId: transfer.toWarehouseId, productId: item.productId } },
          update: { quantity: { increment: item.quantity } },
          create: { warehouseId: transfer.toWarehouseId, productId: item.productId, quantity: parseFloat(item.quantity) },
        });
        // Ledger entries
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { currentStock: true, costPrice: true } });
        await tx.stockLedgerEntry.create({
          data: {
            productId: item.productId,
            movementType: 'TRANSFER_OUT',
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            quantityOut: item.quantity,
            balanceAfter: product.currentStock,
            unitCost: product.costPrice,
            totalValue: parseFloat(product.costPrice) * parseFloat(item.quantity),
            warehouse: transfer.fromWarehouse.name,
            notes: `Transfer ${transfer.transferNumber} → ${transfer.toWarehouse.name}`,
            createdById: req.user.id,
          },
        });
        await tx.stockLedgerEntry.create({
          data: {
            productId: item.productId,
            movementType: 'TRANSFER_IN',
            referenceType: 'StockTransfer',
            referenceId: transfer.id,
            quantityIn: item.quantity,
            balanceAfter: product.currentStock,
            unitCost: product.costPrice,
            totalValue: parseFloat(product.costPrice) * parseFloat(item.quantity),
            warehouse: transfer.toWarehouse.name,
            notes: `Transfer ${transfer.transferNumber} ← ${transfer.fromWarehouse.name}`,
            createdById: req.user.id,
          },
        });
      }
      return tx.stockTransfer.update({
        where: { id: transfer.id },
        data: { status: 'COMPLETED' },
      });
    });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/stock-transfers/:id/cancel
router.post('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const t = await prisma.stockTransfer.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot cancel a completed transfer' });
    const updated = await prisma.stockTransfer.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
