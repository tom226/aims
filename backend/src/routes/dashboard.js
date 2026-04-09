const express = require('express');
const router = express.Router();
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticate, async (req, res, next) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todaySales,
      monthPurchases,
      outstandingInvoices,
      lowStockCount,
      salesLast30,
      purchaseLast30,
      topProducts,
      invoiceStatusBreakdown,
      recentActivity,
    ] = await Promise.all([
      // Today's sales
      prisma.invoice.aggregate({
        where: { createdAt: { gte: startOfDay }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        _sum: { grandTotal: true },
        _count: true,
      }),

      // This month's purchases
      prisma.purchaseOrder.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        _sum: { grandTotal: true },
      }),

      // Outstanding invoices
      prisma.invoice.aggregate({
        where: { status: { in: ['ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { grandTotal: true, amountPaid: true },
        _count: true,
      }),

      // Low stock count
      prisma.$queryRaw`SELECT COUNT(*) FROM products WHERE "currentStock" <= "reorderLevel" AND status = 'ACTIVE'`,

      // Sales last 30 days (daily)
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM("grandTotal")::float as total
        FROM invoices
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          AND status NOT IN ('CANCELLED', 'DRAFT')
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Purchases last 30 days (daily)
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM("grandTotal")::float as total
        FROM purchase_orders
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          AND status NOT IN ('CANCELLED', 'DRAFT')
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Top 5 selling products
      prisma.$queryRaw`
        SELECT p.id, p.name, p.sku, SUM(ii.quantity)::float as total_sold, SUM(ii.total)::float as revenue
        FROM invoice_items ii
        JOIN products p ON ii."productId" = p.id
        JOIN invoices i ON ii."invoiceId" = i.id
        WHERE i.status NOT IN ('CANCELLED', 'DRAFT')
          AND i."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_sold DESC
        LIMIT 5
      `,

      // Invoice status breakdown
      prisma.invoice.groupBy({
        by: ['status'],
        where: { status: { notIn: ['CANCELLED'] } },
        _count: true,
        _sum: { grandTotal: true },
      }),

      // Recent activity (last 10 of each type)
      Promise.all([
        prisma.purchaseOrder.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { supplier: { select: { name: true } } }, select: { id: true, poNumber: true, status: true, grandTotal: true, createdAt: true, supplier: true } }),
        prisma.invoice.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: { select: { name: true } } }, select: { id: true, invoiceNumber: true, status: true, grandTotal: true, createdAt: true, customer: true } }),
      ]),
    ]);

    const [recentPOs, recentInvoices] = recentActivity;

    res.json({
      kpis: {
        todaySales: parseFloat(todaySales._sum.grandTotal || 0),
        todaySalesCount: todaySales._count,
        monthPurchases: parseFloat(monthPurchases._sum.grandTotal || 0),
        outstandingAmount: parseFloat(outstandingInvoices._sum.grandTotal || 0) - parseFloat(outstandingInvoices._sum.amountPaid || 0),
        outstandingCount: outstandingInvoices._count,
        lowStockCount: parseInt(lowStockCount[0]?.count || 0),
      },
      charts: {
        salesLast30: salesLast30.map(r => ({ date: r.date, sales: r.total })),
        purchaseLast30: purchaseLast30.map(r => ({ date: r.date, purchases: r.total })),
        topProducts: topProducts.map(r => ({ id: r.id, name: r.name, sku: r.sku, totalSold: r.total_sold, revenue: r.revenue })),
        invoiceStatus: invoiceStatusBreakdown.map(r => ({ status: r.status, count: r._count, total: parseFloat(r._sum.grandTotal || 0) })),
      },
      recentActivity: {
        purchaseOrders: recentPOs,
        invoices: recentInvoices,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
