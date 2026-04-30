const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

// GET /api/products
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, categoryId, status, lowStock, page = 1, limit = 20 } = req.query;
    const where = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (lowStock === 'true') where.currentStock = { lte: prisma.product.fields.reorderLevel };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, preferredSupplier: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);
    res.json({ data: products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/products/low-stock
router.get('/low-stock', authenticate, async (req, res, next) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT id, sku, name, "currentStock", "reorderLevel", "reorderQuantity", "sellingPrice"
      FROM products
      WHERE "currentStock" <= "reorderLevel" AND status = 'ACTIVE'
      ORDER BY "currentStock" ASC
    `;
    res.json(products);
  } catch (err) { next(err); }
});

// GET /api/products/:id
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        category: true,
        preferredSupplier: { select: { id: true, name: true } },
        stockLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    res.json(product);
  } catch (err) { next(err); }
});

// POST /api/products
router.post('/', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), [
  body('name').notEmpty().trim(),
  body('sellingPrice').isNumeric(),
  body('costPrice').optional().isNumeric(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, description, categoryId, unit, hsnCode, taxRate, costPrice, sellingPrice,
      reorderLevel, reorderQuantity, preferredSupplierId, barcode, storageLocation,
      brand, imageUrl, weight, weightUnit, length, width, height, isComposite } = req.body;

    // Auto-generate SKU
    const count = await prisma.product.count();
    const sku = `SKU-${String(count + 1).padStart(5, '0')}`;

    const product = await prisma.product.create({
      data: {
        sku, name, description,
        categoryId: categoryId || null,
        unit: unit || 'Pcs',
        hsnCode, taxRate: taxRate ? parseFloat(taxRate) : 18,
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        sellingPrice: parseFloat(sellingPrice),
        reorderLevel: reorderLevel ? parseFloat(reorderLevel) : 0,
        reorderQuantity: reorderQuantity ? parseFloat(reorderQuantity) : 0,
        preferredSupplierId: preferredSupplierId || null,
        barcode, storageLocation,
        brand: brand || null,
        imageUrl: imageUrl || null,
        weight: weight ? parseFloat(weight) : null,
        weightUnit: weightUnit || 'kg',
        length: length ? parseFloat(length) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        isComposite: !!isComposite,
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'PRODUCTS', action: 'CREATE', recordId: product.id });
    res.status(201).json(product);
  } catch (err) { next(err); }
});

// PUT /api/products/:id
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const old = await prisma.product.findUniqueOrThrow({ where: { id: req.params.id } });
    const { name, description, categoryId, unit, hsnCode, taxRate, costPrice, sellingPrice,
      reorderLevel, reorderQuantity, preferredSupplierId, barcode, storageLocation,
      brand, imageUrl, weight, weightUnit, length, width, height, isComposite, status } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name, description,
        categoryId: categoryId || null,
        unit, hsnCode,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : undefined,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined,
        sellingPrice: sellingPrice !== undefined ? parseFloat(sellingPrice) : undefined,
        reorderLevel: reorderLevel !== undefined ? parseFloat(reorderLevel) : undefined,
        reorderQuantity: reorderQuantity !== undefined ? parseFloat(reorderQuantity) : undefined,
        preferredSupplierId: preferredSupplierId || null,
        barcode, storageLocation, status,
        brand, imageUrl,
        weight: weight !== undefined && weight !== '' ? parseFloat(weight) : undefined,
        weightUnit, length: length !== undefined && length !== '' ? parseFloat(length) : undefined,
        width: width !== undefined && width !== '' ? parseFloat(width) : undefined,
        height: height !== undefined && height !== '' ? parseFloat(height) : undefined,
        isComposite,
      },
    });

    await createAuditLog({ userId: req.user.id, module: 'PRODUCTS', action: 'UPDATE', recordId: product.id, oldValue: old });
    res.json(product);
  } catch (err) { next(err); }
});

// POST /api/products/bulk-import
// Body: { rows: [{ name, sku?, description?, categoryName?, unit?, hsnCode?, taxRate?, costPrice?, sellingPrice?, reorderLevel?, reorderQuantity?, brand?, barcode?, currentStock? }, ...] }
router.post('/bulk-import', authenticate, authorize('SUPER_ADMIN', 'PROCUREMENT_MANAGER', 'WAREHOUSE_MANAGER'), async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'rows must be a non-empty array' });
    if (rows.length > 1000) return res.status(400).json({ error: 'Max 1000 rows per import' });

    const categoriesByName = new Map();
    const allCats = await prisma.category.findMany({ select: { id: true, name: true } });
    allCats.forEach((c) => categoriesByName.set(c.name.toLowerCase(), c.id));

    const result = { created: 0, updated: 0, skipped: 0, errors: [] };
    let count = await prisma.product.count();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name?.trim()) { result.skipped++; result.errors.push({ row: i + 2, error: 'Missing name' }); continue; }

        let categoryId = null;
        if (row.categoryName) {
          const k = row.categoryName.toLowerCase().trim();
          if (categoriesByName.has(k)) categoryId = categoriesByName.get(k);
          else {
            const c = await prisma.category.create({ data: { name: row.categoryName.trim() } });
            categoryId = c.id;
            categoriesByName.set(k, c.id);
          }
        }

        const data = {
          name: row.name.trim(),
          description: row.description || null,
          categoryId,
          unit: row.unit || 'Pcs',
          hsnCode: row.hsnCode || null,
          taxRate: row.taxRate ? parseFloat(row.taxRate) : 18,
          costPrice: row.costPrice ? parseFloat(row.costPrice) : 0,
          sellingPrice: row.sellingPrice ? parseFloat(row.sellingPrice) : 0,
          reorderLevel: row.reorderLevel ? parseFloat(row.reorderLevel) : 0,
          reorderQuantity: row.reorderQuantity ? parseFloat(row.reorderQuantity) : 0,
          brand: row.brand || null,
          barcode: row.barcode || null,
          currentStock: row.currentStock ? parseFloat(row.currentStock) : 0,
        };

        const sku = row.sku?.trim();
        if (sku) {
          const existing = await prisma.product.findUnique({ where: { sku } });
          if (existing) {
            await prisma.product.update({ where: { id: existing.id }, data });
            result.updated++;
            continue;
          }
        }

        count++;
        const newSku = sku || `SKU-${String(count).padStart(5, '0')}`;
        await prisma.product.create({ data: { ...data, sku: newSku } });
        result.created++;
      } catch (e) {
        result.skipped++;
        result.errors.push({ row: i + 2, error: e.message });
      }
    }

    await createAuditLog({ userId: req.user.id, module: 'PRODUCTS', action: 'BULK_IMPORT', newValue: result });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
