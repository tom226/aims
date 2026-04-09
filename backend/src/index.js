require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const supplierRoutes = require('./routes/suppliers');
const customerRoutes = require('./routes/customers');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const grnRoutes = require('./routes/grn');
const salesOrderRoutes = require('./routes/salesOrders');
const invoiceRoutes = require('./routes/invoices');
const inventoryRoutes = require('./routes/inventory');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');

const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow all .vercel.app and .up.railway.app domains, plus configured origins
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.up.railway.app') ||
      origin.startsWith('http://localhost')
    ) {
      return callback(null, true);
    }
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.',
});

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ─── Static files (uploads) ──────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/grn', grnRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`AIMS API server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;
