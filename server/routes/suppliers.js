import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, COUNT(po.id) as open_pos,
        MAX(po.order_date) as last_order_date
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status != 'received'
      GROUP BY s.id ORDER BY s.name ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/suppliers/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplier = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!supplier.rows[0]) return res.status(404).json({ error: 'Supplier not found' });
    const pos = await pool.query('SELECT * FROM purchase_orders WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 20', [req.params.id]);
    res.json({ ...supplier.rows[0], purchase_orders: pos.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers
router.post('/', authenticateToken, async (req, res) => {
  const { name, country, contact_name, phone, email, address, products_supplied, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO suppliers (name, country, contact_name, phone, email, address, products_supplied, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, country, contact_name, phone, email, address, products_supplied, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, country, contact_name, phone, email, address, products_supplied, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE suppliers SET name=$1, country=$2, contact_name=$3, phone=$4, email=$5, address=$6, products_supplied=$7, notes=$8 WHERE id=$9 RETURNING *`,
      [name, country, contact_name, phone, email, address, products_supplied, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/suppliers/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PURCHASE ORDERS ─────────────────────────────────────────────────────────

// GET /api/suppliers/purchase-orders
router.get('/purchase-orders/all', authenticateToken, async (req, res) => {
  const { status } = req.query;
  try {
    let q = `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE 1=1`;
    const params = [];
    if (status) { params.push(status); q += ` AND po.status = $${params.length}`; }
    q += ` ORDER BY po.created_at DESC`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/suppliers/purchase-orders/:id
router.get('/purchase-orders/:id', authenticateToken, async (req, res) => {
  try {
    const po = await pool.query(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = $1`, [req.params.id]);
    if (!po.rows[0]) return res.status(404).json({ error: 'PO not found' });
    const items = await pool.query(
      `SELECT poi.*, p.name as product_name, p.sku FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.po_id = $1`,
      [req.params.id]
    );
    res.json({ ...po.rows[0], items: items.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/suppliers/purchase-orders
router.post('/purchase-orders', authenticateToken, async (req, res) => {
  const { supplier_id, order_date, expected_arrival, items, total_usd, exchange_rate, shipping_cost, customs_duty_pct, landed_cost_bdt, status, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const year = new Date().getFullYear();
    const count = await client.query(`SELECT COUNT(*) FROM purchase_orders WHERE po_number LIKE $1`, [`PO-${year}-%`]);
    const po_number = `PO-${year}-${(parseInt(count.rows[0].count) + 1).toString().padStart(4, '0')}`;

    const po = await client.query(
      `INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_arrival, total_usd, exchange_rate, shipping_cost, customs_duty_pct, landed_cost_bdt, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [po_number, supplier_id, order_date, expected_arrival, total_usd, exchange_rate || 120, shipping_cost || 0, customs_duty_pct || 0, landed_cost_bdt, status || 'proforma_received', notes]
    );
    for (const item of items || []) {
      await client.query(
        `INSERT INTO purchase_order_items (po_id, product_id, product_name, quantity, unit_cost_usd) VALUES ($1,$2,$3,$4,$5)`,
        [po.rows[0].id, item.product_id, item.product_name, item.quantity, item.unit_cost_usd]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(po.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/suppliers/purchase-orders/:id
router.put('/purchase-orders/:id', authenticateToken, async (req, res) => {
  const { status, expected_arrival, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE purchase_orders SET status=$1, expected_arrival=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [status, expected_arrival, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
