import express from 'express';
import pool from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings - Get all settings (grouped)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT category, key, value FROM settings ORDER BY category, key');
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.key] = row.value;
    }
    res.json(grouped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/settings/:category
router.get('/:category', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings WHERE category = $1', [req.params.category]);
    const settings = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings/:category - Bulk update settings for a category (admin only)
router.put('/:category', authenticateToken, requireRole('admin'), async (req, res) => {
  const settings = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        `INSERT INTO settings (category, key, value, updated_at) VALUES ($1,$2,$3,NOW())
         ON CONFLICT (category, key) DO UPDATE SET value = $3, updated_at = NOW()`,
        [req.params.category, key, value?.toString() ?? '']
      );
    }
    await client.query('COMMIT');
    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module) VALUES ($1,$2,$3,$4)`,
      [req.user.id, req.user.name, `Updated ${req.params.category} settings`, 'Settings']
    );
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/settings/locations/all - Warehouse locations
router.get('/locations/all', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM warehouse_locations ORDER BY is_default DESC, name ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/settings/locations
router.post('/locations', authenticateToken, async (req, res) => {
  const { name, address, contact_person, phone, is_default } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (is_default) await client.query('UPDATE warehouse_locations SET is_default = false');
    const result = await client.query(
      `INSERT INTO warehouse_locations (name, address, contact_person, phone, is_default) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, address, contact_person, phone, is_default || false]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/settings/locations/:id
router.put('/locations/:id', authenticateToken, async (req, res) => {
  const { name, address, contact_person, phone, is_default } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (is_default) await client.query('UPDATE warehouse_locations SET is_default = false');
    const result = await client.query(
      `UPDATE warehouse_locations SET name=$1, address=$2, contact_person=$3, phone=$4, is_default=$5 WHERE id=$6 RETURNING *`,
      [name, address, contact_person, phone, is_default || false, req.params.id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/settings/locations/:id
router.delete('/locations/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM warehouse_locations WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
