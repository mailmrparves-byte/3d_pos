import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reports/sales?from=&to=
router.get('/sales', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  try {
    const params = [from || '2000-01-01', to ? to + ' 23:59:59' : new Date().toISOString()];
    const overview = await pool.query(`
      SELECT
        COALESCE(SUM(grand_total),0) as total_sales,
        COALESCE(SUM(vat_amount),0) as total_vat,
        COALESCE(SUM(discount),0) as total_discounts,
        COALESCE(SUM(grand_total - vat_amount),0) as net_revenue,
        COUNT(*) as transaction_count
      FROM sales WHERE created_at BETWEEN $1 AND $2 AND is_draft = false`, params);

    const byCategory = await pool.query(`
      SELECT p.category, COALESCE(SUM(si.line_total),0) as total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.created_at BETWEEN $1 AND $2 AND s.is_draft = false
      GROUP BY p.category ORDER BY total DESC`, params);

    const byPayment = await pool.query(`
      SELECT payment_method, COALESCE(SUM(grand_total),0) as total, COUNT(*) as count
      FROM sales WHERE created_at BETWEEN $1 AND $2 AND is_draft = false
      GROUP BY payment_method ORDER BY total DESC`, params);

    const daily = await pool.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(grand_total),0) as total, COUNT(*) as count
      FROM sales WHERE created_at BETWEEN $1 AND $2 AND is_draft = false
      GROUP BY DATE(created_at) ORDER BY date ASC`, params);

    res.json({ overview: overview.rows[0], by_category: byCategory.rows, by_payment: byPayment.rows, daily: daily.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/inventory-valuation
router.get('/inventory-valuation', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category,
        COUNT(*) as product_count,
        COALESCE(SUM(stock_qty * cost_price),0) as total_cost_value,
        COALESCE(SUM(stock_qty * selling_price),0) as total_selling_value,
        COALESCE(SUM(stock_qty * (selling_price - cost_price)),0) as potential_profit
      FROM products GROUP BY category ORDER BY total_selling_value DESC`);
    const totals = await pool.query(`
      SELECT COALESCE(SUM(stock_qty * cost_price),0) as grand_cost,
             COALESCE(SUM(stock_qty * selling_price),0) as grand_selling
      FROM products`);
    res.json({ by_category: result.rows, totals: totals.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/slow-moving?days=60
router.get('/slow-moving', authenticateToken, async (req, res) => {
  const { days = 60 } = req.query;
  try {
    const result = await pool.query(`
      SELECT p.id, p.sku, p.name, p.brand, p.category, p.stock_qty, p.selling_price,
        p.stock_qty * p.cost_price as stock_value,
        MAX(s.created_at) as last_sale_date,
        COALESCE(SUM(si.quantity),0) as total_sold
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY p.id
      HAVING COALESCE(SUM(si.quantity),0) = 0 AND p.stock_qty > 0
      ORDER BY p.stock_qty * p.cost_price DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/customer-outstanding
router.get('/customer-outstanding', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM customers WHERE outstanding_balance > 0 ORDER BY outstanding_balance DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/vat?from=&to=
router.get('/vat', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  try {
    const params = [from || '2000-01-01', to ? to + ' 23:59:59' : new Date().toISOString()];
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(grand_total - vat_amount),0) as taxable_value,
        COALESCE(SUM(vat_amount),0) as total_vat_collected,
        COALESCE(SUM(grand_total),0) as total_with_vat,
        COUNT(*) as invoice_count,
        DATE_TRUNC('month', created_at) as period
      FROM sales WHERE created_at BETWEEN $1 AND $2 AND is_draft = false
      GROUP BY period ORDER BY period ASC`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/profit-loss?from=&to=
router.get('/profit-loss', authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  try {
    const params = [from || '2000-01-01', to ? to + ' 23:59:59' : new Date().toISOString()];
    const result = await pool.query(`
      SELECT p.category,
        COALESCE(SUM(si.line_total),0) as revenue,
        COALESCE(SUM(si.quantity * p.cost_price),0) as cogs,
        COALESCE(SUM(si.line_total - (si.quantity * p.cost_price)),0) as gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.created_at BETWEEN $1 AND $2 AND s.is_draft = false
      GROUP BY p.category ORDER BY gross_profit DESC`, params);

    const totals = await pool.query(`
      SELECT
        COALESCE(SUM(si.line_total),0) as total_revenue,
        COALESCE(SUM(si.quantity * p.cost_price),0) as total_cogs,
        COALESCE(SUM(si.line_total - (si.quantity * p.cost_price)),0) as total_gross_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.created_at BETWEEN $1 AND $2 AND s.is_draft = false`, params);

    res.json({ by_category: result.rows, totals: totals.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reports/preorders
router.get('/preorders', authenticateToken, async (req, res) => {
  const { from, to, status } = req.query;
  try {
    let q = `SELECT * FROM preorders WHERE 1=1`;
    const params = [];
    if (from) { params.push(from); q += ` AND created_at >= $${params.length}`; }
    if (to) { params.push(to + ' 23:59:59'); q += ` AND created_at <= $${params.length}`; }
    if (status) { params.push(status); q += ` AND status = $${params.length}`; }
    q += ` ORDER BY created_at DESC`;
    const result = await pool.query(q, params);
    const summary = await pool.query(`
      SELECT COUNT(*) FILTER(WHERE status != 'delivered') as open,
             SUM(advance_paid) FILTER(WHERE status != 'delivered') as advance_held,
             SUM(due_balance) FILTER(WHERE status != 'delivered') as due_to_collect
      FROM preorders WHERE 1=1 ${from ? `AND created_at >= '${from}'` : ''} ${to ? `AND created_at <= '${to} 23:59:59'` : ''}`);
    res.json({ preorders: result.rows, summary: summary.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
