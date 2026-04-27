import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/group-buys
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT gb.*, p.name as product_name_ref,
        (SELECT COUNT(*) FROM group_buy_participants gbp WHERE gbp.group_buy_id = gb.id) as participant_count,
        (SELECT COALESCE(SUM(advance_paid),0) FROM group_buy_participants gbp WHERE gbp.group_buy_id = gb.id) as total_advance_collected
      FROM group_buys gb LEFT JOIN products p ON gb.product_id = p.id
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
    const participants = await pool.query('SELECT * FROM group_buy_participants WHERE group_buy_id = $1 ORDER BY joined_at DESC', [req.params.id]);
    res.json({ ...gb.rows[0], participants: participants.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/group-buys
router.post('/', authenticateToken, async (req, res) => {
  const { product_name, product_id, target_price, min_participants, deadline, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO group_buys (product_name, product_id, target_price, min_participants, deadline, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [product_name, product_id, target_price, min_participants, deadline, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/group-buys/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, deadline, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE group_buys SET status=$1, deadline=$2, notes=$3 WHERE id=$4 RETURNING *`,
      [status, deadline, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/group-buys/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM group_buys WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
