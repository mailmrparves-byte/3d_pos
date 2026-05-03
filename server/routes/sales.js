import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: generate invoice number (uses MAX to avoid race conditions)
async function generateInvoiceNo(client, prefix = 'INV') {
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const result = await (client || pool).query(
    `SELECT invoice_no FROM sales WHERE invoice_no LIKE $1 ORDER BY invoice_no DESC LIMIT 1`,
    [pattern]
  );
  let nextNum = 1;
  if (result.rows.length > 0) {
    const lastNo = result.rows[0].invoice_no;
    const parts = lastNo.split('-');
    nextNum = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  return `${prefix}-${year}-${nextNum.toString().padStart(4, '0')}`;
}

// GET /api/sales - List sales with filters
router.get('/', authenticateToken, async (req, res) => {
  const { from, to, status, payment_method, is_preorder, is_draft, search, limit = 100 } = req.query;
  try {
    let q = `SELECT s.*, u.name as created_by_name FROM sales s LEFT JOIN users u ON s.created_by = u.id WHERE s.deleted_at IS NULL`;
    const params = [];
    if (from) { params.push(from); q += ` AND s.created_at >= $${params.length}`; }
    if (to) { params.push(to + ' 23:59:59'); q += ` AND s.created_at <= $${params.length}`; }
    if (status) { params.push(status); q += ` AND s.status = $${params.length}`; }
    if (payment_method) { params.push(payment_method); q += ` AND s.payment_method = $${params.length}`; }
    if (is_preorder !== undefined) { params.push(is_preorder === 'true'); q += ` AND s.is_preorder = $${params.length}`; }
    if (is_draft !== undefined) { params.push(is_draft === 'true'); q += ` AND s.is_draft = $${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (s.invoice_no ILIKE $${params.length} OR s.customer_name ILIKE $${params.length} OR s.customer_phone ILIKE $${params.length})`;
    }
    params.push(limit);
    q += ` ORDER BY s.created_at DESC LIMIT $${params.length}`;
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sales/today-summary
router.get('/today-summary', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await pool.query(
      `SELECT 
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN payment_method='Cash' THEN amount_received ELSE 0 END), 0) as cash_collected
       FROM sales WHERE DATE(created_at) = $1 AND is_draft = false AND deleted_at IS NULL`,
      [today]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sales/:id/delete-impact
router.get('/:id/delete-impact', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [sale, items, preorder] = await Promise.all([
      pool.query('SELECT invoice_no, customer_name, grand_total FROM sales WHERE id = $1', [id]),
      pool.query('SELECT COUNT(*) as cnt FROM sale_items WHERE sale_id = $1', [id]),
      pool.query('SELECT id, status FROM preorders WHERE sale_id = $1', [id]),
    ]);
    if (!sale.rows[0]) return res.status(404).json({ error: 'Sale not found' });
    res.json({
      invoiceNo: sale.rows[0].invoice_no,
      customerName: sale.rows[0].customer_name,
      grandTotal: parseFloat(sale.rows[0].grand_total),
      linkedItems: parseInt(items.rows[0].cnt),
      hasPreorder: preorder.rows.length > 0,
      preorderStatus: preorder.rows[0]?.status || null,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/sales/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sale = await pool.query(`SELECT s.*, u.name as created_by_name, COALESCE(c.billing_address, c.address) as customer_address FROM sales s LEFT JOIN users u ON s.created_by = u.id LEFT JOIN customers c ON s.customer_id = c.id WHERE s.id = $1`, [req.params.id]);
    if (!sale.rows[0]) return res.status(404).json({ error: 'Sale not found' });
    const items = await pool.query(`SELECT si.*, p.sku, p.brand FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE si.sale_id = $1`, [req.params.id]);
    const preorder = await pool.query('SELECT * FROM preorders WHERE sale_id = $1', [req.params.id]);
    res.json({ ...sale.rows[0], items: items.rows, preorder: preorder.rows[0] || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sales - Create sale (with per-item VAT)
router.post('/', authenticateToken, async (req, res) => {
  const {
    customer_id, customer_name, customer_phone, customer_type, corporate_po,
    items, subtotal, discount, grand_total,
    payment_method, amount_received, change_due, status,
    is_preorder, is_draft, notes,
    preorder, payments, group_buy_id
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-link or create customer if needed
    let finalCustomerId = customer_id || null;
    if (!finalCustomerId && (customer_phone || req.body.customer_address)) {
      if (customer_phone) {
        const existingCustomer = await client.query('SELECT id FROM customers WHERE phone = $1 AND deleted_at IS NULL LIMIT 1', [customer_phone]);
        if (existingCustomer.rows.length > 0) finalCustomerId = existingCustomer.rows[0].id;
      }
      
      if (!finalCustomerId) {
        const newCust = await client.query(
          `INSERT INTO customers (name, phone, billing_address, type) VALUES ($1,$2,$3,$4) RETURNING id`,
          [customer_name || 'Walk-in', customer_phone || '', req.body.customer_address || '', customer_type || 'walk-in']
        );
        finalCustomerId = newCust.rows[0].id;
      }
    }

    const invoice_no = await generateInvoiceNo(client, 'INV');
    const saleResult = await client.query(
      `INSERT INTO sales (invoice_no, customer_id, customer_name, customer_phone, customer_type, corporate_po, subtotal, discount, delivery_charge, grand_total, payment_method, amount_received, change_due, status, is_preorder, is_draft, notes, created_by, payments, group_buy_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
      [invoice_no, finalCustomerId, customer_name, customer_phone, customer_type, corporate_po, subtotal, discount, req.body.delivery_charge || 0, grand_total, payment_method, amount_received, change_due || 0, status || 'paid', is_preorder || false, is_draft || false, notes, req.user.id, JSON.stringify(payments || []), group_buy_id || null]
    );
    const sale = saleResult.rows[0];
    sale.customer_address = req.body.customer_address || '';

    // Insert sale items and deduct stock — with per-item VAT
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount_pct, line_total, is_group_buy)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [sale.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_pct || 0, item.line_total, item.is_group_buy || false]
      );
      if (!is_draft && item.product_id) {
        const stockResult = await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1', [item.quantity, item.product_id]);
        if (stockResult.rowCount === 0) {
          console.warn(`⚠️ Stock deduction failed for product ${item.product_id} (${item.product_name}): insufficient stock for qty ${item.quantity}`);
        }
        // Also update stock_locations
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

    // If preorder, create preorder record
    let preorderRecord = null;
    if (is_preorder && preorder) {
      const preorderNo = `PRE-${new Date().getFullYear()}-${(Date.now() % 10000).toString().padStart(4, '0')}`;
      const prResult = await client.query(
        `INSERT INTO preorders (preorder_no, sale_id, customer_id, customer_name, customer_phone, product_summary, total_amount, advance_paid, due_balance, delivery_date, variant_instructions, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [preorderNo, sale.id, customer_id || null, customer_name, customer_phone,
         items.map(i => `${i.product_name} x${i.quantity}`).join(', '),
         grand_total, preorder.advance_paid, preorder.due_balance,
         preorder.delivery_date, preorder.variant_instructions, 'pending', preorder.notes]
      );
      preorderRecord = prResult.rows[0];
    }

    // Update customer totals
    if (finalCustomerId && !is_draft) {
      await client.query(
        `UPDATE customers SET total_purchases = total_purchases + $1, last_purchase_date = NOW() WHERE id = $2`,
        [grand_total, finalCustomerId]
      );
      const creditPayment = (payments || []).find(p => p.method === 'Credit Account');
      if (creditPayment || payment_method === 'Credit Account') {
        const creditAmount = creditPayment ? creditPayment.amount : (grand_total - (amount_received || 0));
        await client.query(
          `UPDATE customers SET outstanding_balance = outstanding_balance + $1 WHERE id = $2`,
          [creditAmount, finalCustomerId]
        );
      }
    }

    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Created sale ${invoice_no}`, 'POS', sale.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...sale, preorder: preorderRecord });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/sales/:id - Update draft
router.put('/:id', authenticateToken, async (req, res) => {
  const { status, notes, payment_method, amount_received } = req.body;
  try {
    const result = await pool.query(
      'UPDATE sales SET status=$1, notes=$2, payment_method=$3, amount_received=$4 WHERE id=$5 AND deleted_at IS NULL RETURNING *',
      [status, notes, payment_method, amount_received, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/sales/:id - Soft delete
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sale = await client.query('SELECT * FROM sales WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!sale.rows[0]) return res.status(404).json({ error: 'Sale not found' });

    await client.query('UPDATE sales SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2', [req.user.id, req.params.id]);
    await client.query(
      `INSERT INTO trash_log (table_name, record_id, record_data, deleted_by) VALUES ($1,$2,$3,$4)`,
      ['sales', req.params.id, JSON.stringify({ invoice_no: sale.rows[0].invoice_no, customer_name: sale.rows[0].customer_name, grand_total: sale.rows[0].grand_total }), req.user.id]
    );
    await client.query(
      `INSERT INTO activity_log (user_id, user_name, action, module, record_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, req.user.name, `Soft-deleted sale: ${sale.rows[0].invoice_no}`, 'Sales', req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Sale moved to trash' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

export default router;
