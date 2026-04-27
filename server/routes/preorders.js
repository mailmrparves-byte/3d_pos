import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/preorders
router.get('/', authenticateToken, async (req, res) => {
  const { status, from, to } = req.query;
  try {
    let q = `SELECT p.* FROM preorders p WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND p.status = $${params.length}`; }
    if (from) { params.push(from); q += ` AND p.created_at >= $${params.length}`; }
    if (to) { params.push(to + ' 23:59:59'); q += ` AND p.created_at <= $${params.length}`; }
    q += ` ORDER BY p.created_at DESC`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/preorders/summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status != 'delivered') as open_count,
        COALESCE(SUM(advance_paid) FILTER (WHERE status != 'delivered'), 0) as total_advance,
        COALESCE(SUM(due_balance) FILTER (WHERE status != 'delivered'), 0) as total_due,
        COUNT(*) FILTER (WHERE delivery_date <= NOW() + INTERVAL '7 days' AND status != 'delivered') as due_this_week
      FROM preorders
    `);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/preorders/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM preorders WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Preorder not found' });
    const saleItems = await pool.query(
      `SELECT si.*, p.sku, p.brand FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1`,
      [result.rows[0].sale_id]
    );
    res.json({ ...result.rows[0], items: saleItems.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/preorders/:id - Update
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, delivery_date, notes, advance_paid, due_balance, variant_instructions } = req.body;
  try {
    const result = await pool.query(
      `UPDATE preorders SET status=$1, delivery_date=$2, notes=$3, advance_paid=$4, due_balance=$5, variant_instructions=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [status, delivery_date, notes, advance_paid, due_balance, variant_instructions, req.params.id]
    );
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Updated preorder ${result.rows[0].preorder_no} → ${status}`, 'Preorders', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/preorders/:id/deliver - Mark as delivered
router.post('/:id/deliver', authenticateToken, async (req, res) => {
  const { final_payment, payment_method } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pr = await client.query('SELECT * FROM preorders WHERE id = $1', [req.params.id]);
    if (!pr.rows[0]) return res.status(404).json({ error: 'Preorder not found' });

    await client.query(
      `UPDATE preorders SET status='delivered', due_balance=0, updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    await client.query(
      `UPDATE sales SET status='paid', amount_received=$1, payment_method=$2 WHERE id=$3`,
      [pr.rows[0].total_amount, payment_method, pr.rows[0].sale_id]
    );
    if (pr.rows[0].customer_id) {
      await client.query(
        `UPDATE customers SET outstanding_balance = GREATEST(0, outstanding_balance - $1) WHERE id = $2`,
        [pr.rows[0].due_balance, pr.rows[0].customer_id]
      );
    }
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Preorder ${pr.rows[0].preorder_no} marked as delivered`, 'Preorders', req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
