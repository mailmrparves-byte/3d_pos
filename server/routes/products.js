import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/products - List with filters (active only)
router.get('/', authenticateToken, async (req, res) => {
  const { search, category, location, status, brand, sort = 'name', order = 'ASC', limit = 500 } = req.query;
  try {
    let q = `SELECT p.* FROM products p WHERE p.deleted_at IS NULL`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.brand ILIKE $${params.length})`;
    }
    if (category) { params.push(category); q += ` AND p.category = $${params.length}`; }
    if (brand) { params.push(brand); q += ` AND p.brand = $${params.length}`; }
    if (location) { params.push(location); q += ` AND p.location = $${params.length}`; }

    if (status === 'low') q += ` AND p.stock_qty > 0 AND p.stock_qty <= p.low_stock_threshold`;
    if (status === 'critical') q += ` AND p.stock_qty > 0 AND p.stock_qty <= CEIL(p.low_stock_threshold * 0.5)`;
    if (status === 'out') q += ` AND p.stock_qty = 0`;
    if (status === 'in_stock') q += ` AND p.stock_qty > p.low_stock_threshold`;

    const validSorts = ['name', 'sku', 'stock_qty', 'selling_price', 'category', 'brand', 'created_at'];
    const sortField = validSorts.includes(sort) ? sort : 'name';
    params.push(parseInt(limit));
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
      `SELECT p.*
       FROM products p
       WHERE p.stock_qty <= p.low_stock_threshold AND p.deleted_at IS NULL
       ORDER BY p.stock_qty ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});





// GET /api/products/:id/delete-impact
router.get('/:id/delete-impact', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [product, sales, pos, groupBuys] = await Promise.all([
      pool.query('SELECT name FROM products WHERE id = $1', [id]),
      pool.query('SELECT COUNT(*) as cnt FROM sale_items WHERE product_id = $1', [id]),
      pool.query('SELECT COUNT(*) as cnt FROM purchase_order_items WHERE product_id = $1', [id]),
      pool.query('SELECT COUNT(*) as cnt FROM group_buys WHERE product_id = $1 AND status = $2', [id, 'open']),
    ]);
    if (!product.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({
      name: product.rows[0].name,
      linkedSales: parseInt(sales.rows[0].cnt),
      linkedGroupBuys: parseInt(groupBuys.rows[0].cnt),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.* FROM products p WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    res.json({ ...result.rows[0], margin_pct: result.rows[0].cost_price > 0 ? (((result.rows[0].selling_price - result.rows[0].cost_price) / result.rows[0].cost_price) * 100).toFixed(1) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products
router.post('/', authenticateToken, async (req, res) => {
  const { sku, name, brand, category, cost_price, selling_price, stock_qty, low_stock_threshold, location, serial_tracking, expiry_date, notes, unit, weight, size, color, is_liquid } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO products (sku, name, brand, category, cost_price, selling_price, stock_qty, low_stock_threshold, location, serial_tracking, expiry_date, notes, unit, weight, size, color, is_liquid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [sku, name, brand, category, cost_price || 0, selling_price || 0, stock_qty || 0, low_stock_threshold || 5, location || 'Warehouse', serial_tracking ?? false, expiry_date || null, notes, unit || 'Pcs', weight, size, color, is_liquid || false]
    );
    const prod = result.rows[0];
    // Seed stock_locations for the chosen location
    const loc = await client.query('SELECT id FROM warehouse_locations WHERE name = $1 LIMIT 1', [location || 'Warehouse']);
    if (loc.rows[0]) {
      await client.query(
        `INSERT INTO stock_locations (product_id, location_id, qty) VALUES ($1,$2,$3) ON CONFLICT (product_id, location_id) DO UPDATE SET qty = EXCLUDED.qty`,
        [prod.id, loc.rows[0].id, stock_qty || 0]
      );
    }
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Added product: ${name}`, 'Inventory', prod.id]
    );
    await client.query('COMMIT');
    res.status(201).json(prod);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/products/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, brand, category, cost_price, selling_price, low_stock_threshold, location, serial_tracking, expiry_date, notes, unit, weight, size, color, is_liquid } = req.body;
  try {
    const result = await pool.query(
      `UPDATE products SET name=$1, brand=$2, category=$3, cost_price=$4, selling_price=$5, low_stock_threshold=$6, location=$7, serial_tracking=$8, expiry_date=$9, notes=$10, unit=$11, weight=$12, size=$13, color=$14, is_liquid=$15, updated_at=NOW()
       WHERE id=$16 AND deleted_at IS NULL RETURNING *`,
      [name, brand, category, cost_price, selling_price, low_stock_threshold, location, serial_tracking, expiry_date || null, notes, unit, weight, size, color, is_liquid, req.params.id]
    );
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Updated product: ${name}`, 'Inventory', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id - Soft delete
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = await client.query('SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!prod.rows[0]) return res.status(404).json({ error: 'Product not found' });

    await client.query(
      'UPDATE products SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2',
      [req.user.id, req.params.id]
    );
    await client.query(
      `INSERT INTO trash_log (table_name, record_id, record_data, deleted_by) VALUES ($1,$2,$3,$4)`,
      ['products', req.params.id, JSON.stringify(prod.rows[0]), req.user.id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Soft-deleted product: ${prod.rows[0].name}`, 'Inventory', req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Product moved to trash' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// POST /api/products/:id/adjust-stock
router.post('/:id/adjust-stock', authenticateToken, async (req, res) => {
  const { adjustment_type, quantity, reason, from_location, to_location } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.params.id;
    let delta = parseInt(quantity);
    if (['remove', 'damage', 'loss'].includes(adjustment_type)) delta = -Math.abs(delta);
    else if (['add', 'purchase'].includes(adjustment_type)) delta = Math.abs(delta);

    await client.query('UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW() WHERE id = $2', [delta, pid]);

    // Update stock_locations based on adjustment type
    if (adjustment_type === 'transfer' && from_location && to_location) {
      // Transfer: deduct from source, add to destination (products.stock_qty stays the same since delta=0 for transfers)
      // Re-calculate: transfers don't change total stock, so undo the delta we applied above
      await client.query('UPDATE products SET stock_qty = stock_qty - $1, updated_at = NOW() WHERE id = $2', [delta, pid]);
      
      const fromLoc = await client.query('SELECT id FROM warehouse_locations WHERE name = $1 LIMIT 1', [from_location]);
      const toLoc = await client.query('SELECT id FROM warehouse_locations WHERE name = $1 LIMIT 1', [to_location]);
      const transferQty = Math.abs(parseInt(quantity));
      if (fromLoc.rows[0]) {
        await client.query(
          `INSERT INTO stock_locations (product_id, location_id, qty) VALUES ($1,$2,0)
           ON CONFLICT (product_id, location_id) DO NOTHING`,
          [pid, fromLoc.rows[0].id]
        );
        await client.query(
          `UPDATE stock_locations SET qty = GREATEST(0, qty - $1), updated_at = NOW() WHERE product_id = $2 AND location_id = $3`,
          [transferQty, pid, fromLoc.rows[0].id]
        );
      }
      if (toLoc.rows[0]) {
        await client.query(
          `INSERT INTO stock_locations (product_id, location_id, qty) VALUES ($1,$2,$3)
           ON CONFLICT (product_id, location_id) DO UPDATE SET qty = stock_locations.qty + $3, updated_at = NOW()`,
          [pid, toLoc.rows[0].id, transferQty]
        );
      }
    } else if (from_location) {
      // Non-transfer: apply delta to the specified location
      const loc = await client.query('SELECT id FROM warehouse_locations WHERE name = $1 LIMIT 1', [from_location]);
      if (loc.rows[0]) {
        await client.query(
          `INSERT INTO stock_locations (product_id, location_id, qty) VALUES ($1,$2,$3)
           ON CONFLICT (product_id, location_id) DO UPDATE SET qty = GREATEST(0, stock_locations.qty + $3), updated_at = NOW()`,
          [pid, loc.rows[0].id, delta]
        );
      }
    }

    await client.query(
      `INSERT INTO stock_adjustments (product_id, adjustment_type, quantity, reason, from_location, to_location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [pid, adjustment_type, quantity, reason, from_location, to_location, req.user.id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id, details) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, req.user.name, `Stock adjustment (${adjustment_type}): ${quantity}`, 'Inventory', pid, reason]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT stock_qty FROM products WHERE id = $1', [pid]);
    res.json({ success: true, new_stock: updated.rows[0].stock_qty });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
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
