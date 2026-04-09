const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Users
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aims.local' },
    update: {},
    create: { name: 'System Admin', email: 'admin@aims.local', password: hashedPassword, role: 'SUPER_ADMIN' },
  });

  await prisma.user.upsert({
    where: { email: 'rajan@aims.local' },
    update: {},
    create: { name: 'Rajan Kumar', email: 'rajan@aims.local', password: hashedPassword, role: 'PROCUREMENT_MANAGER' },
  });

  await prisma.user.upsert({
    where: { email: 'priya@aims.local' },
    update: {},
    create: { name: 'Priya Sharma', email: 'priya@aims.local', password: hashedPassword, role: 'SALESPERSON' },
  });

  await prisma.user.upsert({
    where: { email: 'aditya@aims.local' },
    update: {},
    create: { name: 'Aditya Verma', email: 'aditya@aims.local', password: hashedPassword, role: 'WAREHOUSE_MANAGER' },
  });

  await prisma.user.upsert({
    where: { email: 'neha@aims.local' },
    update: {},
    create: { name: 'Neha Singh', email: 'neha@aims.local', password: hashedPassword, role: 'FINANCE_MANAGER' },
  });

  // Categories
  const electronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: { name: 'Electronics' },
  });
  const furniture = await prisma.category.upsert({
    where: { name: 'Furniture' },
    update: {},
    create: { name: 'Furniture' },
  });
  const stationery = await prisma.category.upsert({
    where: { name: 'Stationery' },
    update: {},
    create: { name: 'Stationery' },
  });

  // Suppliers
  const supplier1 = await prisma.supplier.upsert({
    where: { supplierNumber: 'SUP-0001' },
    update: {},
    create: {
      supplierNumber: 'SUP-0001',
      name: 'TechParts Pvt Ltd',
      contactPerson: 'Arvind Mehta',
      email: 'arvind@techparts.in',
      phone: '+91 98765 43210',
      gstin: '27AAACT1234A1Z5',
      billingAddress: 'Plot 12, Industrial Area, Pune, MH 411001',
      paymentTerms: 'Net 30',
      status: 'ACTIVE',
      category: 'Electronics',
    },
  });

  const supplier2 = await prisma.supplier.upsert({
    where: { supplierNumber: 'SUP-0002' },
    update: {},
    create: {
      supplierNumber: 'SUP-0002',
      name: 'OfficeWorld Supplies',
      contactPerson: 'Sunita Rao',
      email: 'sunita@officeworld.in',
      phone: '+91 87654 32109',
      gstin: '29BBBCS5678B2Z6',
      billingAddress: 'Block C, Whitefield, Bengaluru, KA 560066',
      paymentTerms: 'Net 15',
      status: 'ACTIVE',
      category: 'Stationery',
    },
  });

  // Customers
  const customer1 = await prisma.customer.upsert({
    where: { customerNumber: 'CUST-0001' },
    update: {},
    create: {
      customerNumber: 'CUST-0001',
      name: 'Horizon Enterprises',
      contactPerson: 'Ramesh Gupta',
      email: 'ramesh@horizon.biz',
      phone: '+91 99887 76655',
      gstin: '27CCCCH9012C3Z7',
      billingAddress: '101, Business Park, Mumbai, MH 400001',
      paymentTerms: 'Net 30',
      creditLimit: 500000,
      customerType: 'WHOLESALE',
      status: 'ACTIVE',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { customerNumber: 'CUST-0002' },
    update: {},
    create: {
      customerNumber: 'CUST-0002',
      name: 'StartupHub Co',
      contactPerson: 'Kiran Desai',
      email: 'kiran@startuphub.in',
      phone: '+91 87766 55443',
      gstin: '29DDDDS3456D4Z8',
      billingAddress: '55, Koramangala, Bengaluru, KA 560034',
      paymentTerms: 'Net 15',
      creditLimit: 200000,
      customerType: 'RETAIL',
      status: 'ACTIVE',
    },
  });

  // Products
  const products = [
    { sku: 'SKU-00001', name: 'Laptop - Core i5', categoryId: electronics.id, unit: 'Pcs', hsnCode: '84713010', taxRate: 18, costPrice: 45000, sellingPrice: 58000, reorderLevel: 5, reorderQuantity: 10, preferredSupplierId: supplier1.id, currentStock: 25 },
    { sku: 'SKU-00002', name: 'Wireless Mouse', categoryId: electronics.id, unit: 'Pcs', hsnCode: '84716060', taxRate: 18, costPrice: 800, sellingPrice: 1200, reorderLevel: 20, reorderQuantity: 50, preferredSupplierId: supplier1.id, currentStock: 120 },
    { sku: 'SKU-00003', name: 'USB-C Hub (7-port)', categoryId: electronics.id, unit: 'Pcs', hsnCode: '85444290', taxRate: 18, costPrice: 1500, sellingPrice: 2400, reorderLevel: 15, reorderQuantity: 30, preferredSupplierId: supplier1.id, currentStock: 45 },
    { sku: 'SKU-00004', name: 'Office Chair (Ergonomic)', categoryId: furniture.id, unit: 'Pcs', hsnCode: '94013000', taxRate: 18, costPrice: 8000, sellingPrice: 12500, reorderLevel: 5, reorderQuantity: 10, currentStock: 18 },
    { sku: 'SKU-00005', name: 'A4 Paper (500 sheets)', categoryId: stationery.id, unit: 'Ream', hsnCode: '48021000', taxRate: 12, costPrice: 200, sellingPrice: 320, reorderLevel: 50, reorderQuantity: 200, preferredSupplierId: supplier2.id, currentStock: 3 },
    { sku: 'SKU-00006', name: 'Ball Pen (Blue, Pack of 10)', categoryId: stationery.id, unit: 'Pack', hsnCode: '96081010', taxRate: 12, costPrice: 50, sellingPrice: 85, reorderLevel: 100, reorderQuantity: 500, preferredSupplierId: supplier2.id, currentStock: 250 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  console.log('✅ Seed complete!');
  console.log('\n📋 Demo Accounts:');
  console.log('  admin@aims.local     — Super Admin');
  console.log('  rajan@aims.local     — Procurement Manager');
  console.log('  priya@aims.local     — Salesperson');
  console.log('  aditya@aims.local    — Warehouse Manager');
  console.log('  neha@aims.local      — Finance Manager');
  console.log('  Password for all: Admin@123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
