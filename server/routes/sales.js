import express from 'express';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper: generate invoice number
async function generateInvoiceNo(prefix = 'INV') {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `SELECT COUNT(*) as cnt FROM sales WHERE invoice_no LIKE $1`,
    [`${prefix}-${year}-%`]
  );
  const num = (parseInt(result.rows[0].cnt) + 1).toString().padStart(4, '0');
  return `${prefix}-${year}-${num}`;
}

// GET /api/sales - List sales with filters
router.get('/', authenticateToken, async (req, res) => {
  const { from, to, status, payment_method, is_preorder, is_draft, search, limit = 100 } = req.query;
  try {
    let q = `SELECT s.*, u.name as created_by_name FROM sales s LEFT JOIN users u ON s.created_by = u.id WHERE 1=1`;
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
        COALESCE(SUM(vat_amount), 0) as total_vat,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN payment_method='Cash' THEN amount_received ELSE 0 END), 0) as cash_collected
       FROM sales WHERE DATE(created_at) = $1 AND is_draft = false`,
      [today]
    );
    res.json(result.rows[0]);
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

// POST /api/sales - Create sale
router.post('/', authenticateToken, async (req, res) => {
  const {
    customer_id, customer_name, customer_phone, customer_type, corporate_po,
    items, subtotal, vat_amount, discount, grand_total,
    payment_method, amount_received, change_due, status,
    is_preorder, is_draft, notes,
    preorder, payments
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-link or create customer if needed
    let finalCustomerId = customer_id || null;
    if (!finalCustomerId && (customer_phone || req.body.customer_address)) {
      if (customer_phone) {
        const existingCustomer = await client.query('SELECT id FROM customers WHERE phone = $1 LIMIT 1', [customer_phone]);
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

    const invoice_no = await generateInvoiceNo('INV');
    const saleResult = await client.query(
      `INSERT INTO sales (invoice_no, customer_id, customer_name, customer_phone, customer_type, corporate_po, subtotal, vat_amount, discount, grand_total, payment_method, amount_received, change_due, status, is_preorder, is_draft, notes, created_by, payments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, $19) RETURNING *`,
      [invoice_no, finalCustomerId, customer_name, customer_phone, customer_type, corporate_po, subtotal, vat_amount, discount, grand_total, payment_method, amount_received, change_due || 0, status || 'paid', is_preorder || false, is_draft || false, notes, req.user.id, JSON.stringify(payments || [])]
    );
    const sale = saleResult.rows[0];
    sale.customer_address = req.body.customer_address || '';

    // Insert sale items and deduct stock
    for (const item of items) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, discount_pct, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [sale.id, item.product_id, item.product_name, item.quantity, item.unit_price, item.discount_pct || 0, item.line_total]
      );
      if (!is_draft && item.product_id) {
        await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2 AND stock_qty >= $1', [item.quantity, item.product_id]);
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
      // Credit Account logic for multiple payments
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
      'UPDATE sales SET status=$1, notes=$2, payment_method=$3, amount_received=$4 WHERE id=$5 RETURNING *',
      [status, notes, payment_method, amount_received, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
