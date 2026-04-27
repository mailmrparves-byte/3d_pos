import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/customers
router.get('/', authenticateToken, async (req, res) => {
  const { search, type, limit = 200 } = req.query;
  try {
    let q = `
      SELECT c.*, 
        (SELECT id FROM sales s WHERE s.customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sale_id,
        (SELECT invoice_no FROM sales s WHERE s.customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_invoice_no
      FROM customers c WHERE 1=1
    `;
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.company ILIKE $${params.length})`;
    }
    if (type) { params.push(type); q += ` AND c.type = $${params.length}`; }
    params.push(limit);
    q += ` ORDER BY c.name ASC LIMIT $${params.length}`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/customers/overdue
router.get('/overdue', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM customers WHERE outstanding_balance > 0 ORDER BY outstanding_balance DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/customers/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!customer.rows[0]) return res.status(404).json({ error: 'Customer not found' });
    const sales = await pool.query('SELECT * FROM sales WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.params.id]);
    const preorders = await pool.query('SELECT * FROM preorders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]);
    res.json({ ...customer.rows[0], sales: sales.rows, preorders: preorders.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/customers
router.post('/', authenticateToken, async (req, res) => {
  const { name, phone, email, address, billing_address, company, type, credit_limit, payment_terms, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO customers (name, phone, email, address, billing_address, company, type, credit_limit, payment_terms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, phone, email, address, billing_address, company, type || 'walk-in', credit_limit || 0, payment_terms || 'Net 15', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/customers/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, phone, email, address, billing_address, company, type, credit_limit, payment_terms, notes, outstanding_balance } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, billing_address=$5, company=$6, type=$7, credit_limit=$8, payment_terms=$9, notes=$10, outstanding_balance=COALESCE($11, outstanding_balance)
       WHERE id=$12 RETURNING *`,
      [name, phone, email, address, billing_address, company, type, credit_limit, payment_terms, notes, outstanding_balance, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/customers/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
