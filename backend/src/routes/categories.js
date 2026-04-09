const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// GET /api/categories
router.get('/', authenticate, async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: { children: true, _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) { next(err); }
});

// POST /api/categories
router.post('/', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER'), [
  body('name').notEmpty().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const category = await prisma.category.create({ data: { name: req.body.name, parentId: req.body.parentId || null } });
    res.status(201).json(category);
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count > 0) return res.status(400).json({ error: 'Category has products. Reassign them first.' });
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
