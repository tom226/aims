const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// GET /api/users
router.get('/', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', authenticate, authorize('SUPER_ADMIN'), [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'SALESPERSON', 'WAREHOUSE_MANAGER', 'FINANCE_MANAGER', 'VIEWER']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await createAuditLog({ userId: req.user.id, module: 'USERS', action: 'CREATE', recordId: user.id, newValue: { name, email, role } });
    res.status(201).json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id
router.patch('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, role, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(name && { name }), ...(role && { role }), ...(isActive !== undefined && { isActive }) },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    await createAuditLog({ userId: req.user.id, module: 'USERS', action: 'UPDATE', recordId: user.id });
    res.json(user);
  } catch (err) { next(err); }
});

// GET /api/users/audit-logs
router.get('/audit-logs', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, module, userId } = req.query;
    const where = {};
    if (module) where.module = module;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data: logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

module.exports = router;
