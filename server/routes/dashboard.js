import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard
router.get('/', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [
      todaySales,
      preorderSummary,
      lowStockCount,
      overdueCustomers,
      activeGroupBuys,
      recentTransactions,
      lowStockItems
    ] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(grand_total),0) as total, COUNT(*) as count FROM sales WHERE DATE(created_at) = $1 AND is_draft = false AND deleted_at IS NULL`, [today]),
      pool.query(`SELECT COALESCE(SUM(advance_paid),0) as total_advance, COALESCE(SUM(due_balance),0) as total_due, COUNT(*) as count FROM preorders WHERE status != 'delivered'`),
      pool.query(`SELECT COUNT(*) FROM products WHERE stock_qty <= low_stock_threshold AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM customers WHERE outstanding_balance > 0 AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*) FROM group_buys WHERE status = 'open'`),
      pool.query(`
        SELECT s.id, s.invoice_no, s.customer_name, s.grand_total, s.payment_method, s.status, s.is_preorder, s.created_at,
          (SELECT STRING_AGG(si.product_name || ' x' || si.quantity, ', ') FROM sale_items si WHERE si.sale_id = s.id) as products
        FROM sales s WHERE s.is_draft = false AND s.deleted_at IS NULL ORDER BY s.created_at DESC LIMIT 10`),
      pool.query(`
        SELECT p.id, p.sku, p.name, p.brand, p.category, p.stock_qty, p.low_stock_threshold, p.location,
          CASE WHEN p.stock_qty = 0 THEN 'out'
               WHEN p.stock_qty <= CEIL(p.low_stock_threshold * 0.5) THEN 'critical'
               ELSE 'low' END as stock_status
        FROM products p WHERE p.stock_qty <= p.low_stock_threshold AND p.deleted_at IS NULL ORDER BY p.stock_qty ASC LIMIT 20`)
    ]);

    res.json({
      today_sales: parseFloat(todaySales.rows[0].total),
      today_transaction_count: parseInt(todaySales.rows[0].count),
      preorder_advance_held: parseFloat(preorderSummary.rows[0].total_advance),
      preorder_due_balance: parseFloat(preorderSummary.rows[0].total_due),
      open_preorders: parseInt(preorderSummary.rows[0].count),
      low_stock_count: parseInt(lowStockCount.rows[0].count),
      overdue_customers: parseInt(overdueCustomers.rows[0].count),
      active_group_buys: parseInt(activeGroupBuys.rows[0].count),
      recent_transactions: recentTransactions.rows,
      low_stock_items: lowStockItems.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
