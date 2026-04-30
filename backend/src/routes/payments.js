const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { generateDocNumber } = require('../utils/docNumber');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { customerId, invoiceId, from, to, page = 1, limit = 20 } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (from || to) where.paymentDate = {};
    if (from) where.paymentDate.gte = new Date(from);
    if (to) where.paymentDate.lte = new Date(to);

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { name: true } },
          invoice: { select: { invoiceNumber: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where }),
    ]);
    res.json({ data, total });
  } catch (err) { next(err); }
});

router.post('/', authenticate, authorize('SUPER_ADMIN', 'FINANCE_MANAGER', 'SALESPERSON'), async (req, res, next) => {
  try {
    const { customerId, invoiceId, amount, paymentDate, paymentMode, referenceNo, notes } = req.body;
    if (!customerId) return res.status(400).json({ error: 'Customer is required' });
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    if (!paymentMode) return res.status(400).json({ error: 'Payment mode is required' });

    const paymentNumber = await generateDocNumber(prisma, 'PMT', 'paymentNumber', 'payment');

    const created = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNumber, customerId,
          invoiceId: invoiceId || null,
          amount: parseFloat(amount),
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMode, referenceNo, notes,
          createdById: req.user.id,
        },
        include: { customer: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } },
      });

      // If linked to invoice, update amountPaid + status
      if (invoiceId) {
        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: { amountPaid: { increment: parseFloat(amount) } },
        });
        const newPaid = parseFloat(inv.amountPaid);
        const total = parseFloat(inv.grandTotal);
        let newStatus = inv.status;
        if (newPaid >= total) newStatus = 'FULLY_PAID';
        else if (newPaid > 0) newStatus = 'PARTIALLY_PAID';
        if (newStatus !== inv.status) {
          await tx.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
        }
      }

      // Decrement customer outstanding balance
      await tx.customer.update({
        where: { id: customerId },
        data: { outstandingBalance: { decrement: parseFloat(amount) } },
      });

      return payment;
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

module.exports = router;
