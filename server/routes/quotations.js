import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: generate quotation number
async function generateQuotationNo() {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `SELECT COUNT(*) as cnt FROM quotations WHERE quotation_no LIKE $1`,
    [`QT-${year}-%`]
  );
  const num = (parseInt(result.rows[0].cnt) + 1).toString().padStart(4, '0');
  return `QT-${year}-${num}`;
}

// GET /api/quotations
router.get('/', authenticateToken, async (req, res) => {
  const { from, to, status, search, limit = 100 } = req.query;
  try {
    let q = `SELECT q.*, u.name as created_by_name FROM quotations q LEFT JOIN users u ON q.created_by = u.id WHERE q.deleted_at IS NULL`;
    const params = [];
    
    if (from) { params.push(from); q += ` AND q.created_at >= $${params.length}`; }
    if (to) { params.push(to + ' 23:59:59'); q += ` AND q.created_at <= $${params.length}`; }
    if (status) { params.push(status); q += ` AND q.status = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (q.quotation_no ILIKE $${params.length} OR q.customer_name ILIKE $${params.length} OR q.customer_phone ILIKE $${params.length})`;
    }
    
    params.push(limit);
    q += ` ORDER BY q.created_at DESC LIMIT $${params.length}`;
    
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/quotations/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const qResult = await pool.query(
      `SELECT q.*, u.name as created_by_name FROM quotations q LEFT JOIN users u ON q.created_by = u.id WHERE q.id = $1`, 
      [req.params.id]
    );
    if (!qResult.rows[0]) return res.status(404).json({ error: 'Quotation not found' });
    
    const itemsResult = await pool.query(
      `SELECT qi.*, p.sku, p.brand FROM quotation_items qi LEFT JOIN products p ON qi.product_id = p.id WHERE qi.quotation_id = $1`, 
      [req.params.id]
    );
    
    res.json({ ...qResult.rows[0], items: itemsResult.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quotations
router.post('/', authenticateToken, async (req, res) => {
  const {
    customer_id, customer_name, customer_phone, customer_address, customer_type,
    items, subtotal, discount, grand_total, notes, status = 'draft'
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const quotation_no = await generateQuotationNo();
    
    const result = await client.query(
      `INSERT INTO quotations (quotation_no, customer_id, customer_name, customer_phone, customer_address, customer_type, subtotal, discount, delivery_charge, grand_total, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [quotation_no, customer_id, customer_name, customer_phone, customer_address, customer_type, subtotal, discount || 0, req.body.delivery_charge || 0, grand_total, status, notes, req.user.id]
    );
    const quotation = result.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [quotation.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_pct || 0, item.line_total]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(quotation);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// PUT /api/quotations/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, notes, items, subtotal, discount, grand_total } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update main quote
    await client.query(
      `UPDATE quotations SET status=$1, notes=$2, subtotal=$3, discount=$4, delivery_charge=$5, grand_total=$6 WHERE id=$7`,
      [status, notes, subtotal, discount, req.body.delivery_charge || 0, grand_total, req.params.id]
    );

    if (items) {
      await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
      for (const item of items) {
        await client.query(
          `INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, unit_price, discount_pct, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [req.params.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_pct || 0, item.line_total]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// DELETE /api/quotations/:id (Soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('UPDATE quotations SET deleted_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/quotations/:id/convert
router.post('/:id/convert', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // D7: Lock the row to prevent double-conversion under concurrency
    const qResult = await client.query('SELECT * FROM quotations WHERE id = $1 AND deleted_at IS NULL FOR UPDATE', [req.params.id]);
    const quote = qResult.rows[0];
    if (!quote) return res.status(404).json({ error: 'Quotation not found' });
    if (quote.status === 'converted') return res.status(400).json({ error: 'Quotation already converted' });

    const itemsResult = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1', [req.params.id]);
    const items = itemsResult.rows;

    // D6: Use MAX-based invoice number generation (same as sales.js fix)
    const year = new Date().getFullYear();
    const pattern = `INV-${year}-%`;
    const invResult = await client.query(
      `SELECT invoice_no FROM sales WHERE invoice_no LIKE $1 ORDER BY invoice_no DESC LIMIT 1`,
      [pattern]
    );
    let nextNum = 1;
    if (invResult.rows.length > 0) {
      const parts = invResult.rows[0].invoice_no.split('-');
      nextNum = (parseInt(parts[parts.length - 1]) || 0) + 1;
    }
    const invoice_no = `INV-${year}-${nextNum.toString().padStart(4, '0')}`;

    // Create Sale
    const saleResult = await client.query(
      `INSERT INTO sales (invoice_no, customer_id, customer_name, customer_phone, customer_type, subtotal, discount, delivery_charge, grand_total, payment_method, amount_received, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [invoice_no, quote.customer_id, quote.customer_name, quote.customer_phone, quote.customer_type, quote.subtotal, quote.discount, quote.delivery_charge || 0, quote.grand_total, 'Cash', quote.grand_total, 'paid', req.user.id]
    );
    const saleId = saleResult.rows[0].id;

    // Insert sale items and deduct stock
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount_pct, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [saleId, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_pct, item.line_total]
      );
      
      if (item.product_id) {
        // Deduct from products table
        const stockResult = await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1', [item.quantity, item.product_id]);
        if (stockResult.rowCount === 0) {
          console.warn(`⚠️ Stock deduction failed for product ${item.product_id} (${item.product_name}): insufficient stock for qty ${item.quantity}`);
        }

        // D3: Also deduct from stock_locations
        const locResult = await client.query(
          `SELECT sl.id FROM stock_locations sl JOIN warehouse_locations wl ON sl.location_id = wl.id WHERE sl.product_id = $1 ORDER BY sl.qty DESC LIMIT 1`,
          [item.product_id]
        );
        if (locResult.rows[0]) {
          await client.query(
            `UPDATE stock_locations SET qty = GREATEST(0, qty - $1), updated_at = NOW() WHERE id = $2`,
            [item.quantity, locResult.rows[0].id]
          );
        }
      }
    }

    // D4: Update customer totals
    if (quote.customer_id) {
      await client.query(
        `UPDATE customers SET total_purchases = total_purchases + $1, last_purchase_date = NOW() WHERE id = $2`,
        [quote.grand_total, quote.customer_id]
      );
    }

    // Update Quotation Status
    await client.query(
      `UPDATE quotations SET status='converted', converted_at=NOW(), converted_to_sale_id=$1 WHERE id=$2`,
      [saleId, req.params.id]
    );

    // D5: Activity log
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Converted quotation ${quote.quotation_no} → Invoice ${invoice_no}`, 'Quotations', saleId]
    );

    await client.query('COMMIT');
    res.json({ success: true, sale_id: saleId, invoice_no });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

export default router;
