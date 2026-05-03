import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  // ── Soft-delete columns ────────────────────────────────────────
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);`,
  `ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_address TEXT;`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
  `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);`,
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`,
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id);`,

  // ── Trash log ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS trash_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    record_data JSONB,
    deleted_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP DEFAULT NOW(),
    permanent_deleted_at TIMESTAMP
  );`,

  // ── VAT per-product ───────────────────────────────────────────
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 15;`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_type VARCHAR(20) DEFAULT 'standard';`,

  // ── VAT per sale_item ─────────────────────────────────────────
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 15;`,
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(14,2) DEFAULT 0;`,

  // ── Categories table ──────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // ── Brands table ──────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // ── Stock locations (per product per location) ────────────────
  `CREATE TABLE IF NOT EXISTS stock_locations (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES warehouse_locations(id) ON DELETE CASCADE,
    qty INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, location_id)
  );`,

  // ── Stock transfers log ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS stock_transfers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(300),
    from_location_id INTEGER REFERENCES warehouse_locations(id),
    to_location_id INTEGER REFERENCES warehouse_locations(id),
    from_location_name VARCHAR(100),
    to_location_name VARCHAR(100),
    qty INTEGER NOT NULL,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // ── Backups table ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    trigger_type VARCHAR(20) DEFAULT 'manual',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  // ── Indexes ───────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_customers_deleted ON customers(deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_deleted ON sales(deleted_at);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_locations_product ON stock_locations(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_stock_transfers_product ON stock_transfers(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_trash_log_table ON trash_log(table_name);`,

  // ── M2: Missing columns on sales & sale_items ─────────────────
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(14,2) DEFAULT 0;`,
  `ALTER TABLE sales ADD COLUMN IF NOT EXISTS group_buy_id INTEGER REFERENCES group_buys(id) ON DELETE SET NULL;`,
  `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_group_buy BOOLEAN DEFAULT false;`,

  // ── M1: Quotations tables ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quotations (
    id SERIAL PRIMARY KEY,
    quotation_no VARCHAR(30) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(20),
    customer_address TEXT,
    customer_type VARCHAR(30),
    subtotal DECIMAL(14,2) DEFAULT 0,
    discount DECIMAL(14,2) DEFAULT 0,
    delivery_charge DECIMAL(14,2) DEFAULT 0,
    grand_total DECIMAL(14,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    converted_at TIMESTAMP,
    converted_to_sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(300),
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(14,2) DEFAULT 0,
    discount_pct DECIMAL(5,2) DEFAULT 0,
    line_total DECIMAL(14,2) DEFAULT 0
  );`,

  // ── M1: Group buy products table ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS group_buy_products (
    id SERIAL PRIMARY KEY,
    group_buy_id INTEGER REFERENCES group_buys(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(300),
    quantity INTEGER DEFAULT 1,
    target_price DECIMAL(14,2) DEFAULT 0
  );`,

  // ── Quotation indexes ─────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);`,
  `CREATE INDEX IF NOT EXISTS idx_quotations_deleted ON quotations(deleted_at);`,

  // ── Seed default categories ───────────────────────────────────
  `INSERT INTO categories (name) VALUES
    ('3D Printers'), ('Filaments'), ('Tools'), ('Meters'), ('Soldering'),
    ('Pneumatic'), ('Electrical'), ('CNC & Laser'), ('Microscopes'),
    ('Flow Meters'), ('Consumables'), ('Other')
  ON CONFLICT DO NOTHING;`,

  // ── Seed default brands ───────────────────────────────────────
  `INSERT INTO brands (name) VALUES
    ('Bambu Lab'), ('SUNLU'), ('Harden'), ('Yato'), ('VICTOR'), ('FNIRSI'),
    ('BAKU'), ('ABB'), ('Schneider'), ('xTool'), ('LaserPecker'), ('Generic')
  ON CONFLICT (name) DO NOTHING;`,

  // ── Seed stock_locations from existing products.stock_qty ─────
  `INSERT INTO stock_locations (product_id, location_id, qty)
   SELECT p.id, w.id, p.stock_qty
   FROM products p
   JOIN warehouse_locations w ON w.name = p.location
   WHERE p.deleted_at IS NULL
   ON CONFLICT (product_id, location_id) DO NOTHING;`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔧 Running migrations...');
    for (const sql of migrations) {
      await client.query(sql);
      console.log('  ✅ ' + sql.trim().split('\n')[0].substring(0, 80));
    }
    console.log('\n🎉 All migrations complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
