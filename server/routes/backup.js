import express from 'express';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const router = express.Router();

// Sanitize filename to prevent path traversal
function sanitizeFilename(name) {
  return path.basename((name || '').replace(/[\/\\]/g, ''));
}

// Ensure backups directory exists
async function ensureDir() {
  try { await fs.mkdir(BACKUP_DIR, { recursive: true }); } catch {}
}

// Find pg_dump / psql executables
function findPgBin(bin) {
  const paths = [
    `${bin}`, // in PATH
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${bin}.exe`,
    `C:\\Program Files\\PostgreSQL\\15\\bin\\${bin}.exe`,
    `C:\\Program Files\\PostgreSQL\\14\\bin\\${bin}.exe`,
    `/usr/bin/${bin}`,
    `/usr/local/bin/${bin}`,
  ];
  return paths;
}

// POST /api/backup/create - Create a new database backup
router.post('/create', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  await ensureDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);
  const dbUrl = process.env.DATABASE_URL;

  // Try multiple pg_dump locations
  const pgDumpPaths = findPgBin('pg_dump');
  let pgDump = 'pg_dump';

  for (const p of pgDumpPaths) {
    try {
      await new Promise((resolve, reject) => {
        exec(`"${p}" --version`, (err) => err ? reject(err) : resolve());
      });
      pgDump = p;
      break;
    } catch {}
  }

  const cmd = `"${pgDump}" --dbname="${dbUrl}" --file="${filepath}" --no-owner --no-acl`;

  try {
    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });

    const stats = await fs.stat(filepath);
    const result = await pool.query(
      `INSERT INTO backups (filename, size_bytes, trigger_type, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [filename, stats.size, req.body.trigger || 'manual', req.user.id]
    );

    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module) VALUES ($1,$2,$3,$4)`,
      [req.user.id, req.user.name, `Created database backup: ${filename}`, 'Backup']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
});

// GET /api/backup/list - List all backups
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, u.name as created_by_name FROM backups b LEFT JOIN users u ON b.created_by = u.id ORDER BY b.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/backup/download/:filename - Download a backup file
router.get('/download/:filename', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const safe = sanitizeFilename(req.params.filename);
  if (!safe || safe !== req.params.filename) return res.status(400).json({ error: 'Invalid filename' });
  const filepath = path.join(BACKUP_DIR, safe);
  try {
    await fs.access(filepath);
    res.download(filepath, safe);
  } catch {
    res.status(404).json({ error: 'Backup file not found' });
  }
});

// DELETE /api/backup/:id - Delete a backup
router.delete('/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const backup = await pool.query('SELECT filename FROM backups WHERE id = $1', [req.params.id]);
    if (!backup.rows[0]) return res.status(404).json({ error: 'Backup not found' });

    const filepath = path.join(BACKUP_DIR, backup.rows[0].filename);
    try { await fs.unlink(filepath); } catch {}

    await pool.query('DELETE FROM backups WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/backup/restore - Restore from uploaded SQL file (DANGEROUS)
router.post('/restore', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  if (req.body.confirm !== 'RESTORE') return res.status(400).json({ error: 'Must confirm with "RESTORE"' });

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Filename required' });

  const safe = sanitizeFilename(filename);
  if (!safe || safe !== filename) return res.status(400).json({ error: 'Invalid filename' });
  const filepath = path.join(BACKUP_DIR, safe);
  const dbUrl = process.env.DATABASE_URL;

  const pgPaths = findPgBin('psql');
  let psqlBin = 'psql';
  for (const p of pgPaths) {
    try {
      await new Promise((resolve, reject) => {
        exec(`"${p}" --version`, (err) => err ? reject(err) : resolve());
      });
      psqlBin = p;
      break;
    } catch {}
  }

  const cmd = `"${psqlBin}" --dbname="${dbUrl}" --file="${filepath}"`;

  try {
    await new Promise((resolve, reject) => {
      exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      });
    });

    await pool.query(
      `INSERT INTO activity_log (user_id, user_name, action, module) VALUES ($1,$2,$3,$4)`,
      [req.user.id, req.user.name, `Restored database from: ${filename}`, 'Backup']
    );

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

export default router;
