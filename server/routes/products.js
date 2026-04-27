import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/products - List with filters
router.get('/', authenticateToken, async (req, res) => {
  const { search, category, location, status, supplier_id, sort = 'name', order = 'ASC', limit = 200 } = req.query;
  try {
    let q = `SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.brand ILIKE $${params.length})`;
    }
    if (category) { params.push(category); q += ` AND p.category = $${params.length}`; }
    if (location) { params.push(location); q += ` AND p.location = $${params.length}`; }
    if (supplier_id) { params.push(supplier_id); q += ` AND p.supplier_id = $${params.length}`; }
    if (status === 'low') q += ` AND p.stock_qty > 0 AND p.stock_qty <= p.low_stock_threshold`;
    if (status === 'critical') q += ` AND p.stock_qty > 0 AND p.stock_qty <= CEIL(p.low_stock_threshold * 0.5)`;
    if (status === 'out') q += ` AND p.stock_qty = 0`;
    if (status === 'in_stock') q += ` AND p.stock_qty > p.low_stock_threshold`;

    const validSorts = ['name', 'sku', 'stock_qty', 'selling_price', 'category', 'brand'];
    const sortField = validSorts.includes(sort) ? sort : 'name';
    params.push(limit);
    q += ` ORDER BY p.${sortField} ${order === 'DESC' ? 'DESC' : 'ASC'} LIMIT $${params.length}`;

    const result = await pool.query(q, params);
    const products = result.rows.map(p => ({
      ...p,
      margin_pct: p.cost_price > 0 ? (((p.selling_price - p.cost_price) / p.cost_price) * 100).toFixed(1) : 0,
      stock_status: p.stock_qty === 0 ? 'out' : p.stock_qty <= Math.ceil(p.low_stock_threshold * 0.5) ? 'critical' : p.stock_qty <= p.low_stock_threshold ? 'low' : 'in_stock'
    }));
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/low-stock
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name,
        CASE WHEN p.stock_qty = 0 THEN 'out'
             WHEN p.stock_qty <= CEIL(p.low_stock_threshold * 0.5) THEN 'critical'
             ELSE 'low' END as stock_status
       FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.stock_qty <= p.low_stock_threshold
       ORDER BY p.stock_qty ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.name as supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ ...result.rows[0], margin_pct: result.rows[0].cost_price > 0 ? (((result.rows[0].selling_price - result.rows[0].cost_price) / result.rows[0].cost_price) * 100).toFixed(1) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products
router.post('/', authenticateToken, async (req, res) => {
  const { sku, name, brand, category, cost_price, selling_price, vat_applicable, stock_qty, low_stock_threshold, location, serial_tracking, expiry_date, supplier_id, notes, unit, weight, size, color, is_liquid } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO products (sku, name, brand, category, cost_price, selling_price, vat_applicable, stock_qty, low_stock_threshold, location, serial_tracking, expiry_date, supplier_id, notes, unit, weight, size, color, is_liquid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [sku, name, brand, category, cost_price || 0, selling_price || 0, vat_applicable ?? true, stock_qty || 0, low_stock_threshold || 5, location || 'Showroom', serial_tracking ?? false, expiry_date || null, supplier_id || null, notes, unit || 'Pcs', weight, size, color, is_liquid || false]
    );
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Added product: ${name}`, 'Inventory', result.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/products/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, brand, category, cost_price, selling_price, vat_applicable, low_stock_threshold, location, serial_tracking, expiry_date, supplier_id, notes, unit, weight, size, color, is_liquid } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, brand=$2, category=$3, cost_price=$4, selling_price=$5, vat_applicable=$6, low_stock_threshold=$7, location=$8, serial_tracking=$9, expiry_date=$10, supplier_id=$11, notes=$12, unit=$13, weight=$14, size=$15, color=$16, is_liquid=$17, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [name, brand, category, cost_price, selling_price, vat_applicable, low_stock_threshold, location, serial_tracking, expiry_date || null, supplier_id || null, notes, unit, weight, size, color, is_liquid, req.params.id]
    );
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Updated product: ${name}`, 'Inventory', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products/:id/adjust-stock
router.post('/:id/adjust-stock', authenticateToken, async (req, res) => {
  const { adjustment_type, quantity, reason, from_location, to_location } = req.body;
  try {
    const pid = req.params.id;
    let delta = parseInt(quantity);
    if (adjustment_type === 'remove' || adjustment_type === 'damage' || adjustment_type === 'loss') delta = -Math.abs(delta);
    else if (adjustment_type === 'add' || adjustment_type === 'purchase') delta = Math.abs(delta);
    // transfer: no stock change just location note

    await pool.query('UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW() WHERE id = $2', [delta, pid]);
    await pool.query(
      `INSERT INTO stock_adjustments (product_id, adjustment_type, quantity, reason, from_location, to_location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [pid, adjustment_type, quantity, reason, from_location, to_location, req.user.id]
    );
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id, details) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, req.user.name, `Stock adjustment (${adjustment_type}): ${quantity}`, 'Inventory', pid, reason]
    );
    const updated = await pool.query('SELECT stock_qty FROM products WHERE id = $1', [pid]);
    res.json({ success: true, new_stock: updated.rows[0].stock_qty });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id/adjustments
router.get('/:id/adjustments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sa.*, u.name as user_name FROM stock_adjustments sa LEFT JOIN users u ON sa.created_by = u.id
       WHERE sa.product_id = $1 ORDER BY sa.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
