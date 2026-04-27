import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users
router.get('/', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, role, status, assigned_location, last_login, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, email, phone, password, role, custom_permissions, assigned_location, status, notes, force_password_change } = req.body;
  try {
    const hash = await bcrypt.hash(password || 'changeme123', 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, custom_permissions, assigned_location, status, notes, force_password_change)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name, email, role`,
      [name, email, phone, hash, role, custom_permissions ? JSON.stringify(custom_permissions) : null, assigned_location, status || 'active', notes, force_password_change ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, email, phone, role, custom_permissions, assigned_location, status, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, role=$4, custom_permissions=$5, assigned_location=$6, status=$7, notes=$8
       WHERE id=$9 RETURNING id, name, email, role, status`,
      [name, email, phone, role, custom_permissions ? JSON.stringify(custom_permissions) : null, assigned_location, status, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', authenticateToken, requireRole('admin'), async (req, res) => {
  const { new_password } = req.body;
  try {
    const hash = await bcrypt.hash(new_password || 'changeme123', 10);
    await pool.query('UPDATE users SET password_hash=$1, force_password_change=true WHERE id=$2', [hash, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await pool.query('UPDATE users SET status=$1 WHERE id=$2', ['inactive', req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/activity-log
router.get('/activity-log', authenticateToken, requireRole('admin', 'manager'), async (req, res) => {
  const { user_id, module, from, to, limit = 100 } = req.query;
  try {
    let q = `SELECT al.*, u.email FROM activity_log al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1`;
    const params = [];
    if (user_id) { params.push(user_id); q += ` AND al.user_id = $${params.length}`; }
    if (module) { params.push(module); q += ` AND al.module = $${params.length}`; }
    if (from) { params.push(from); q += ` AND al.created_at >= $${params.length}`; }
    if (to) { params.push(to); q += ` AND al.created_at <= $${params.length}`; }
    params.push(limit);
    q += ` ORDER BY al.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Custom roles
router.get('/custom-roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM custom_roles ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/custom-roles', authenticateToken, requireRole('admin'), async (req, res) => {
  const { name, permissions } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO custom_roles (name, permissions) VALUES ($1, $2) RETURNING *',
      [name, JSON.stringify(permissions)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
