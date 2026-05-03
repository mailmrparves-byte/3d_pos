import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import preorderRoutes from './routes/preorders.js';
import customerRoutes from './routes/customers.js';
import groupBuyRoutes from './routes/groupbuys.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';
import trashRoutes from './routes/trash.js';
import inventoryRoutes from './routes/inventory.js';
import backupRoutes from './routes/backup.js';
import quotationRoutes from './routes/quotations.js';
import uploadRoutes from './routes/uploads.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ 
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:5173'] : '*', 
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/preorders', preorderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/group-buys', groupBuyRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  
  // All other routes should serve the frontend index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Industrial 3D Solution API Server running on http://localhost:${PORT}`);
});
