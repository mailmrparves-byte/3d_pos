import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════

router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, pc.name as parent_name,
        (SELECT COUNT(*) FROM products p WHERE p.category = c.name AND p.deleted_at IS NULL) as product_count
       FROM categories c
       LEFT JOIN categories pc ON c.parent_id = pc.id
       ORDER BY c.parent_id NULLS FIRST, c.name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authenticateToken, async (req, res) => {
  const { name, parent_id, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO categories (name, parent_id, description) VALUES ($1,$2,$3) RETURNING *`,
      [name, parent_id || null, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', authenticateToken, async (req, res) => {
  const { name, parent_id, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE categories SET name=$1, parent_id=$2, description=$3 WHERE id=$4 RETURNING *`,
      [name, parent_id || null, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// BRANDS
// ═══════════════════════════════════════════════════════════════════

router.get('/brands', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*,
        (SELECT COUNT(*) FROM products p WHERE p.brand = b.name AND p.deleted_at IS NULL) as product_count
       FROM brands b ORDER BY b.name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/brands', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO brands (name, description) VALUES ($1,$2) RETURNING *`,
      [name, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/brands/:id', authenticateToken, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      `UPDATE brands SET name=$1, description=$2 WHERE id=$3 RETURNING *`,
      [name, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM brands WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// STOCK LOCATIONS (per-product per-location quantities)
// ═══════════════════════════════════════════════════════════════════

// GET /api/inventory/warehouse-stock
router.get('/warehouse-stock', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.sku, p.name, p.brand, p.category, p.stock_qty as total_qty,
        COALESCE(sl.qty, 0) as warehouse_qty, wl.name as location_name
       FROM products p
       LEFT JOIN stock_locations sl ON sl.product_id = p.id
       LEFT JOIN warehouse_locations wl ON sl.location_id = wl.id AND wl.name = 'Warehouse'
       WHERE p.deleted_at IS NULL
       ORDER BY p.name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/showroom-stock
router.get('/showroom-stock', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.sku, p.name, p.brand, p.category, p.stock_qty as total_qty,
        sl.qty as location_qty, wl.name as location_name, wl.id as location_id
       FROM products p
       JOIN stock_locations sl ON sl.product_id = p.id
       JOIN warehouse_locations wl ON sl.location_id = wl.id AND wl.name != 'Warehouse'
       WHERE p.deleted_at IS NULL AND sl.qty > 0
       ORDER BY wl.name, p.name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/locations
router.get('/locations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wl.*, 
        COALESCE(SUM(sl.qty), 0) as total_stock,
        COUNT(DISTINCT sl.product_id) as product_count
       FROM warehouse_locations wl
       LEFT JOIN stock_locations sl ON sl.location_id = wl.id
       GROUP BY wl.id
       ORDER BY wl.is_default DESC, wl.name`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// STOCK TRANSFERS
// ═══════════════════════════════════════════════════════════════════

// POST /api/inventory/transfers
router.post('/transfers', authenticateToken, async (req, res) => {
  const { product_id, from_location_id, to_location_id, qty, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate warehouse has enough
    const fromStock = await client.query(
      'SELECT qty FROM stock_locations WHERE product_id = $1 AND location_id = $2',
      [product_id, from_location_id]
    );
    const available = fromStock.rows[0]?.qty || 0;
    if (available <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot transfer: Stock at source is 0.' });
    }
    if (qty > available) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient stock at source. Available: ${available}` });
    }

    // Deduct from source
    await client.query(
      `UPDATE stock_locations SET qty = qty - $1, updated_at = NOW()
       WHERE product_id = $2 AND location_id = $3`,
      [qty, product_id, from_location_id]
    );

    // Add to destination
    await client.query(
      `INSERT INTO stock_locations (product_id, location_id, qty) VALUES ($1,$2,$3)
       ON CONFLICT (product_id, location_id) DO UPDATE SET qty = stock_locations.qty + $3, updated_at = NOW()`,
      [product_id, to_location_id, qty]
    );

    // Get location names for log
    const [fromLoc, toLoc, prod] = await Promise.all([
      client.query('SELECT name FROM warehouse_locations WHERE id = $1', [from_location_id]),
      client.query('SELECT name FROM warehouse_locations WHERE id = $1', [to_location_id]),
      client.query('SELECT name FROM products WHERE id = $1', [product_id]),
    ]);

    // Log transfer
    await client.query(
      `INSERT INTO stock_transfers (product_id, product_name, from_location_id, to_location_id, from_location_name, to_location_name, qty, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [product_id, prod.rows[0]?.name, from_location_id, to_location_id, fromLoc.rows[0]?.name, toLoc.rows[0]?.name, qty, notes, req.user.id]
    );

    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id, details) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, req.user.name, `Stock transfer: ${qty} units of ${prod.rows[0]?.name}`, 'Inventory', product_id,
       `${fromLoc.rows[0]?.name} → ${toLoc.rows[0]?.name}`]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Transfer completed' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// GET /api/inventory/transfers
router.get('/transfers', authenticateToken, async (req, res) => {
  const { product_id, from_date, to_date, limit = 100 } = req.query;
  try {
    let q = `SELECT st.*, u.name as created_by_name FROM stock_transfers st LEFT JOIN users u ON st.created_by = u.id WHERE 1=1`;
    const params = [];
    if (product_id) { params.push(product_id); q += ` AND st.product_id = $${params.length}`; }
    if (from_date) { params.push(from_date); q += ` AND st.created_at >= $${params.length}`; }
    if (to_date) { params.push(to_date + ' 23:59:59'); q += ` AND st.created_at <= $${params.length}`; }
    params.push(parseInt(limit));
    q += ` ORDER BY st.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/inventory/adjustments - Global adjustments log
router.get('/adjustments', authenticateToken, async (req, res) => {
  const { limit = 100 } = req.query;
  try {
    const result = await pool.query(
      `SELECT sa.*, u.name as user_name, p.name as product_name, p.sku
       FROM stock_adjustments sa
       LEFT JOIN users u ON sa.created_by = u.id
       LEFT JOIN products p ON sa.product_id = p.id
       ORDER BY sa.created_at DESC LIMIT $1`,
      [parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
