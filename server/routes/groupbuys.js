import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/group-buys
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT gb.*,
        (SELECT COUNT(*) FROM group_buy_participants gbp WHERE gbp.group_buy_id = gb.id) as participant_count,
        (SELECT COALESCE(SUM(advance_paid),0) FROM group_buy_participants gbp WHERE gbp.group_buy_id = gb.id) as total_advance_collected,
        (SELECT json_agg(gbp.*) FROM group_buy_products gbp WHERE gbp.group_buy_id = gb.id) as products
      FROM group_buys gb
      ORDER BY gb.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/group-buys/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const gb = await pool.query('SELECT * FROM group_buys WHERE id = $1', [req.params.id]);
    if (!gb.rows[0]) return res.status(404).json({ error: 'Group buy not found' });
    
    const products = await pool.query('SELECT * FROM group_buy_products WHERE group_buy_id = $1', [req.params.id]);
    const participants = await pool.query('SELECT * FROM group_buy_participants WHERE group_buy_id = $1 ORDER BY joined_at DESC', [req.params.id]);
    
    res.json({ ...gb.rows[0], products: products.rows, participants: participants.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/group-buys
router.post('/', authenticateToken, async (req, res) => {
  const { name, products, target_price, min_participants, deadline, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Use first product name as event name if not provided
    const eventName = name || (products && products.length > 0 ? `Group Buy: ${products[0].product_name}` : 'Unnamed Group Buy');

    const result = await client.query(
      `INSERT INTO group_buys (product_name, target_price, min_participants, deadline, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [eventName || 'Unnamed Event', target_price || 0, 0, deadline, notes]
    );
    
    const gbId = result.rows[0].id;
    
    if (products && products.length > 0) {
      for (const p of products) {
        await client.query(
          `INSERT INTO group_buy_products (group_buy_id, product_id, product_name, quantity, target_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [gbId, p.product_id, p.product_name, p.quantity || 1, p.target_price || 0]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// PUT /api/group-buys/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, status, deadline, notes, products } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update main event
    const gbResult = await client.query(
      `UPDATE group_buys SET product_name=$1, status=$2, deadline=$3, notes=$4 WHERE id=$5 RETURNING *`,
      [name, status, deadline, notes, req.params.id]
    );

    if (products && Array.isArray(products)) {
      // Refresh products: delete and re-insert (simplest approach for junction table)
      await client.query('DELETE FROM group_buy_products WHERE group_buy_id = $1', [req.params.id]);
      for (const p of products) {
        await client.query(
          `INSERT INTO group_buy_products (group_buy_id, product_id, product_name, quantity, target_price)
           VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, p.product_id, p.product_name, p.quantity || 1, p.target_price || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.json(gbResult.rows[0]);
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// DELETE /api/group-buys/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM group_buy_products WHERE group_buy_id = $1', [req.params.id]);
    await client.query('DELETE FROM group_buy_participants WHERE group_buy_id = $1', [req.params.id]);
    await client.query('DELETE FROM group_buys WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// POST /api/group-buys/:id/participants
router.post('/:id/participants', authenticateToken, async (req, res) => {
  const { customer_name, phone, email, advance_paid } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO group_buy_participants (group_buy_id, customer_name, phone, email, advance_paid) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, customer_name, phone, email, advance_paid || 0]
    );
    await pool.query(`UPDATE group_buys SET current_participants = current_participants + 1, total_advance = total_advance + $1 WHERE id = $2`, [advance_paid || 0, req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/group-buys/:id/participants/:pid
router.delete('/:id/participants/:pid', authenticateToken, async (req, res) => {
  try {
    const p = await pool.query('SELECT * FROM group_buy_participants WHERE id = $1', [req.params.pid]);
    if (p.rows[0]) {
      await pool.query(`UPDATE group_buys SET current_participants = GREATEST(0, current_participants - 1), total_advance = GREATEST(0, total_advance - $1) WHERE id = $2`, [p.rows[0].advance_paid, req.params.id]);
    }
    await pool.query('DELETE FROM group_buy_participants WHERE id = $1', [req.params.pid]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
