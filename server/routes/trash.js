import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/trash - List all soft-deleted records
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, u.name as deleted_by_name
       FROM trash_log t
       LEFT JOIN users u ON t.deleted_by = u.id
       WHERE t.permanent_deleted_at IS NULL
       ORDER BY t.deleted_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/trash/:table/:id/restore - Restore a soft-deleted record
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:table/:id/restore', authenticateToken, async (req, res) => {
  const { table, id } = req.params;
  const allowed = ['products', 'customers', 'sales'];
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Invalid table' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE ${table} SET deleted_at = NULL, deleted_by = NULL WHERE id = $1`, [id]);
    await client.query(
      `UPDATE trash_log SET permanent_deleted_at = NULL, deleted_at = deleted_at
       WHERE table_name = $1 AND record_id = $2 AND permanent_deleted_at IS NULL`,
      [table, id]
    );
    // Mark trash entry as restored (reuse permanent_deleted_at = epoch as flag)
    await client.query(
      `DELETE FROM trash_log WHERE table_name = $1 AND record_id = $2 AND permanent_deleted_at IS NULL`,
      [table, id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Restored ${table.slice(0,-1)} #${id} from trash`, table, id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: `${table.slice(0,-1)} restored successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/trash/:table/:id/permanent - Permanently delete a record
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:table/:id/permanent', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { confirm } = req.body;
  if (confirm !== 'DELETE') return res.status(400).json({ error: 'Must confirm with "DELETE"' });

  const { table, id } = req.params;
  const allowed = ['products', 'customers', 'sales'];
  if (!allowed.includes(table)) return res.status(400).json({ error: 'Invalid table or cannot permanently delete' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${table} WHERE id = $1 AND deleted_at IS NOT NULL`, [id]);
    await client.query(
      `UPDATE trash_log SET permanent_deleted_at = NOW()
       WHERE table_name = $1 AND record_id = $2`,
      [table, id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Permanently deleted ${table.slice(0,-1)} #${id}`, table, id]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/trash/empty - Permanently purge records older than 30 days
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/empty', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Get old soft-deleted records
    const old = await client.query(
      `SELECT table_name, record_id FROM trash_log
       WHERE permanent_deleted_at IS NULL AND deleted_at < NOW() - INTERVAL '30 days'`
    );
    const allowed = ['products', 'customers', 'sales'];
    for (const row of old.rows) {
      if (allowed.includes(row.table_name)) {
        await client.query(`DELETE FROM ${row.table_name} WHERE id = $1`, [row.record_id]);
      }
    }
    const result = await client.query(
      `UPDATE trash_log SET permanent_deleted_at = NOW()
       WHERE permanent_deleted_at IS NULL AND deleted_at < NOW() - INTERVAL '30 days'
       RETURNING id`
    );
    await client.query('COMMIT');
    res.json({ success: true, purged: result.rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

export default router;
