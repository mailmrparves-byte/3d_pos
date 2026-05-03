import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
-- ============================================
-- INDUSTRIAL 3D SOLUTION — DATABASE SCHEMA
-- ============================================

-- Settings table (key-value store for all app settings)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category, key)
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) DEFAULT 'salesperson',
  custom_permissions JSONB,
  assigned_location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  force_password_change BOOLEAN DEFAULT false,
  notes TEXT,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  address TEXT,
  company VARCHAR(200),
  type VARCHAR(30) DEFAULT 'walk-in',
  credit_limit DECIMAL(14,2) DEFAULT 0,
  payment_terms VARCHAR(20) DEFAULT 'Net 15',
  outstanding_balance DECIMAL(14,2) DEFAULT 0,
  total_purchases DECIMAL(14,2) DEFAULT 0,
  last_purchase_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  country VARCHAR(100),
  contact_name VARCHAR(150),
  phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  products_supplied TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(300) NOT NULL,
  brand VARCHAR(100),
  category VARCHAR(100),
  cost_price DECIMAL(14,2) DEFAULT 0,
  selling_price DECIMAL(14,2) DEFAULT 0,
  vat_applicable BOOLEAN DEFAULT true,
  stock_qty INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  location VARCHAR(100) DEFAULT 'Showroom',
  serial_tracking BOOLEAN DEFAULT false,
  expiry_date DATE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  unit VARCHAR(50) DEFAULT 'Pcs',
  weight VARCHAR(100),
  size VARCHAR(100),
  color VARCHAR(100),
  is_liquid BOOLEAN DEFAULT false,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_no VARCHAR(30) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(20),
  customer_type VARCHAR(30),
  corporate_po VARCHAR(50),
  subtotal DECIMAL(14,2) DEFAULT 0,
  vat_amount DECIMAL(14,2) DEFAULT 0,
  discount DECIMAL(14,2) DEFAULT 0,
  grand_total DECIMAL(14,2) DEFAULT 0,
  payment_method TEXT,
  payments JSONB,
  amount_received DECIMAL(14,2) DEFAULT 0,
  change_due DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'paid',
  is_preorder BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sale items table
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(300),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(14,2) DEFAULT 0,
  discount_pct DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(14,2) DEFAULT 0
);

-- Preorders table
CREATE TABLE IF NOT EXISTS preorders (
  id SERIAL PRIMARY KEY,
  preorder_no VARCHAR(30) UNIQUE NOT NULL,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(150),
  customer_phone VARCHAR(20),
  product_summary TEXT,
  total_amount DECIMAL(14,2) DEFAULT 0,
  advance_paid DECIMAL(14,2) DEFAULT 0,
  due_balance DECIMAL(14,2) DEFAULT 0,
  delivery_date DATE,
  variant_instructions TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Stock adjustments table
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  from_location VARCHAR(100),
  to_location VARCHAR(100),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(30) UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date DATE DEFAULT CURRENT_DATE,
  expected_arrival DATE,
  total_usd DECIMAL(14,2) DEFAULT 0,
  exchange_rate DECIMAL(10,2) DEFAULT 120,
  shipping_cost DECIMAL(14,2) DEFAULT 0,
  customs_duty_pct DECIMAL(5,2) DEFAULT 0,
  landed_cost_bdt DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(30) DEFAULT 'proforma_received',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Purchase order items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(300),
  quantity INTEGER DEFAULT 1,
  unit_cost_usd DECIMAL(14,2) DEFAULT 0
);

-- Group buys table
CREATE TABLE IF NOT EXISTS group_buys (
  id SERIAL PRIMARY KEY,
  product_name VARCHAR(300) NOT NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  target_price DECIMAL(14,2) DEFAULT 0,
  min_participants INTEGER DEFAULT 5,
  current_participants INTEGER DEFAULT 0,
  total_advance DECIMAL(14,2) DEFAULT 0,
  deadline DATE,
  status VARCHAR(20) DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Group buy participants table
CREATE TABLE IF NOT EXISTS group_buy_participants (
  id SERIAL PRIMARY KEY,
  group_buy_id INTEGER REFERENCES group_buys(id) ON DELETE CASCADE,
  customer_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(150),
  advance_paid DECIMAL(14,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'joined',
  joined_at TIMESTAMP DEFAULT NOW()
);

-- AI conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  user_name VARCHAR(150),
  action VARCHAR(200) NOT NULL,
  module VARCHAR(50),
  record_id INTEGER,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Custom roles table
CREATE TABLE IF NOT EXISTS custom_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  permissions JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Warehouse locations table
CREATE TABLE IF NOT EXISTS warehouse_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  contact_person VARCHAR(150),
  phone VARCHAR(20),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_no);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_preorders_status ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at);
`;

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('🔧 Initializing database schema...');
    await client.query(schema);
    console.log('✅ Schema created successfully.');

    // Insert default admin user
    const adminExists = await client.query("SELECT id FROM users WHERE email = 'admin@industrial.com.bd'");
    if (adminExists.rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Admin', 'admin@industrial.com.bd', '+880 1918-138880', hash, 'admin', 'active']
      );
      console.log('✅ Default admin user created (admin@industrial.com.bd / admin123)');
    }

    // Insert default settings
    const defaultSettings = [
      // Business Profile
      ['business', 'company_name', 'Industrial 3D Solution'],
      ['business', 'company_tagline', 'Your Industrial Supply Partner'],
      ['business', 'website', 'https://www.industrial.com.bd'],
      ['business', 'primary_phone', '+880 1918-138880'],
      ['business', 'whatsapp', '+880 1918-138880'],
      ['business', 'email', 'support@industrial.com.bd'],
      ['business', 'address', 'Level-6, B-63, Malibag, DIT Road, Dhaka-1217, Bangladesh'],
      ['business', 'city', 'Dhaka'],
      ['business', 'country', 'Bangladesh'],
      ['business', 'vat_reg_no', ''],
      ['business', 'trade_license', ''],
      ['business', 'tin_number', ''],
      // Invoice settings
      ['invoice', 'template', 'modern'],
      ['invoice', 'color_theme', '#0ea5e9'],
      ['invoice', 'show_logo', 'true'],
      ['invoice', 'paper_size', 'A4'],
      ['invoice', 'invoice_prefix', 'INV'],
      ['invoice', 'invoice_format', 'INV-YYYY-XXXX'],
      ['invoice', 'starting_number', '1001'],
      ['invoice', 'preorder_prefix', 'PRE'],
      ['invoice', 'po_prefix', 'PO'],
      ['invoice', 'title_text', 'Tax Invoice'],
      ['invoice', 'show_vat_breakdown', 'true'],
      ['invoice', 'show_sku', 'true'],
      ['invoice', 'show_brand', 'true'],
      ['invoice', 'show_cost_price', 'false'],
      ['invoice', 'show_margin', 'false'],
      ['invoice', 'show_thank_you', 'true'],
      ['invoice', 'thank_you_text', 'Thank you for your business!'],
      ['invoice', 'footer_note', 'Products once sold are not returnable unless defective. Warranty as per manufacturer terms.'],
      ['invoice', 'footer_contact', 'WhatsApp: +880 1918-138880 | Email: support@industrial.com.bd'],
      ['invoice', 'show_bank_details', 'false'],
      ['invoice', 'show_bkash', 'true'],
      ['invoice', 'bkash_number', '+880 1918-138880'],
      ['invoice', 'show_nagad', 'false'],
      ['invoice', 'show_qr', 'false'],
      ['invoice', 'terms_text', 'All prices are in BDT. Payment due upon receipt unless credit terms are agreed.'],
      ['invoice', 'return_policy', 'Products must be returned within 7 days in original packaging for exchange only.'],
      ['invoice', 'warranty_note', 'Warranty claims must be accompanied by original invoice.'],
      ['invoice', 'language', 'english'],
      // Tax settings
      ['tax', 'enable_vat', 'true'],
      ['tax', 'vat_rate', '15'],
      ['tax', 'vat_label', 'VAT @15%'],
      ['tax', 'vat_inclusive', 'false'],
      ['tax', 'vat_on_services', 'true'],
      ['tax', 'vat_on_advance', 'true'],
      ['tax', 'tax_period_start', 'January'],
      ['tax', 'enable_secondary_tax', 'false'],
      // Payment settings
      ['payment', 'enable_cash', 'true'],
      ['payment', 'enable_bkash', 'true'],
      ['payment', 'bkash_merchant', '+880 1918-138880'],
      ['payment', 'enable_nagad', 'true'],
      ['payment', 'nagad_merchant', ''],
      ['payment', 'enable_rocket', 'false'],
      ['payment', 'enable_bank', 'true'],
      ['payment', 'enable_credit', 'true'],
      ['payment', 'default_method', 'Cash'],
      ['payment', 'default_credit_terms', 'Net 15'],
      ['payment', 'max_credit_limit', '500000'],
      ['payment', 'overdue_after_days', '30'],
      ['payment', 'min_advance_pct', '20'],
      ['payment', 'min_advance_pct_high', '25'],
      ['payment', 'high_value_threshold', '100000'],
      ['payment', 'require_full_advance_import', 'false'],
      ['payment', 'show_advance_warning', 'true'],
      // Inventory settings
      ['inventory', 'threshold_3d_printers', '2'],
      ['inventory', 'threshold_meters', '5'],
      ['inventory', 'threshold_tools', '5'],
      ['inventory', 'threshold_filaments', '10'],
      ['inventory', 'threshold_consumables', '10'],
      ['inventory', 'threshold_electrical', '5'],
      ['inventory', 'threshold_pneumatic', '5'],
      ['inventory', 'threshold_other', '5'],
      ['inventory', 'serial_min_price', '10000'],
      ['inventory', 'enable_expiry', 'true'],
      ['inventory', 'expiry_warn_days', '30'],
      ['inventory', 'costing_method', 'weighted_average'],
      // POS settings
      ['pos', 'default_customer_type', 'walk-in'],
      ['pos', 'allow_below_cost', 'false'],
      ['pos', 'allow_negative_stock', 'false'],
      ['pos', 'auto_apply_vat', 'true'],
      ['pos', 'show_product_image', 'true'],
      ['pos', 'show_stock_qty', 'true'],
      ['pos', 'show_last_price', 'false'],
      ['pos', 'barcode_support', 'false'],
      ['pos', 'default_discount', '0'],
      ['pos', 'max_discount', '30'],
      ['pos', 'manager_pin', '1234'],
      ['pos', 'auto_print', 'true'],
      ['pos', 'show_change_calculator', 'true'],
      ['pos', 'allow_drafts', 'true'],
      ['pos', 'require_customer_info', 'false'],
      // AI settings
      ['ai', 'enabled', 'true'],
      ['ai', 'provider', 'gemini'],
      ['ai', 'model', 'gemini-2.0-flash'],
      ['ai', 'api_key', ''],
      ['ai', 'language', 'english'],
      ['ai', 'max_length', 'medium'],
      ['ai', 'show_on_dashboard', 'true'],
      ['ai', 'show_on_pos', 'true'],
      ['ai', 'show_on_inventory', 'true'],
      ['ai', 'show_on_customers', 'true'],
      ['ai', 'show_on_suppliers', 'true'],
      ['ai', 'show_on_reports', 'true'],
    ];

    for (const [category, key, value] of defaultSettings) {
      await client.query(
        `INSERT INTO settings (category, key, value) VALUES ($1, $2, $3) ON CONFLICT (category, key) DO NOTHING`,
        [category, key, value]
      );
    }
    console.log('✅ Default settings inserted.');

    // Insert sample products
    const sampleProducts = [
      ['PRN-BL-P1S', 'Bambu Lab P1S Combo', 'Bambu Lab', '3D Printers', 55000, 72000, true, 5, 2, 'Showroom'],
      ['PRN-BL-X1C', 'Bambu Lab X1 Carbon Combo', 'Bambu Lab', '3D Printers', 95000, 125000, true, 3, 2, 'Showroom'],
      ['PRN-BL-A1M', 'Bambu Lab A1 Mini Combo', 'Bambu Lab', '3D Printers', 25000, 35000, true, 8, 2, 'Showroom'],
      ['FIL-BL-PLA-BK', 'PLA Basic Filament 1kg Black', 'Bambu Lab', 'Filaments', 1800, 2500, true, 25, 10, 'Warehouse'],
      ['FIL-BL-PETG-WH', 'PETG Filament 1kg White', 'Bambu Lab', 'Filaments', 2200, 3000, true, 15, 10, 'Warehouse'],
      ['FIL-SU-PLA-RD', 'PLA+ Filament 1kg Red', 'SUNLU', 'Filaments', 1200, 1800, true, 30, 10, 'Warehouse'],
      ['FIL-BL-TPU-BK', 'TPU 95A Filament 1kg Black', 'Bambu Lab', 'Filaments', 3500, 4800, true, 8, 10, 'Warehouse'],
      ['TL-HD-WR-SET', 'Harden Professional Wrench Set', 'Harden', 'Tools', 3500, 4500, true, 12, 5, 'Showroom'],
      ['TL-YT-SCR-SET', 'Yato Screwdriver Set 12pc', 'Yato', 'Tools', 2800, 3800, true, 8, 5, 'Showroom'],
      ['MTR-VC-DM890D', 'VICTOR VC890D Digital Multimeter', 'VICTOR', 'Meters', 3200, 4200, true, 6, 5, 'Showroom'],
      ['MTR-FN-DSO150', 'FNIRSI DSO150 Oscilloscope', 'FNIRSI', 'Meters', 4500, 6500, true, 4, 5, 'Showroom'],
      ['SLD-BK-858D', 'BAKU 858D Hot Air Station', 'BAKU', 'Soldering', 5500, 7500, true, 3, 5, 'Showroom'],
      ['ELC-ABB-MCB', 'ABB MCB 32A Single Pole', 'ABB', 'Electrical', 850, 1200, true, 20, 5, 'Warehouse'],
      ['ELC-SCH-CNTCR', 'Schneider LC1D09 Contactor', 'Schneider', 'Electrical', 3200, 4500, true, 7, 5, 'Warehouse'],
      ['LSR-XT-D1PRO', 'xTool D1 Pro Laser Engraver', 'xTool', 'CNC & Laser', 48000, 65000, true, 2, 2, 'Showroom'],
      ['LSR-LP-4', 'LaserPecker 4 Dual Laser', 'LaserPecker', 'CNC & Laser', 55000, 75000, true, 1, 2, 'Showroom'],
      ['PNM-FIT-SET', 'Pneumatic Quick Fitting Set', 'Generic', 'Pneumatic', 800, 1200, true, 15, 5, 'Warehouse'],
      ['CSM-NOZZLE-04', 'Brass Nozzle 0.4mm (10 pack)', 'Generic', 'Consumables', 500, 800, true, 50, 10, 'Warehouse'],
      ['CSM-BED-SHEET', 'PEI Bed Sheet 235x235mm', 'Generic', 'Consumables', 600, 1000, true, 20, 10, 'Warehouse'],
      ['PRN-BL-H2S', 'Bambu Lab H2S (Upcoming)', 'Bambu Lab', '3D Printers', 0, 0, true, 0, 2, 'Warehouse'],
    ];

    for (const p of sampleProducts) {
      await client.query(
        `INSERT INTO products (sku, name, brand, category, cost_price, selling_price, vat_applicable, stock_qty, low_stock_threshold, location)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (sku) DO NOTHING`,
        p
      );
    }
    console.log('✅ Sample products inserted.');

    // Insert default warehouse locations
    await client.query(`INSERT INTO warehouse_locations (name, address, contact_person, phone, is_default) VALUES
      ('Showroom', 'Level-6, B-63, Malibag, DIT Road, Dhaka-1217', 'Admin', '+880 1918-138880', true),
      ('Warehouse', 'Malibag Storage, Dhaka', 'Warehouse Manager', '+880 1918-138880', false)
      ON CONFLICT DO NOTHING`);
    console.log('✅ Default locations inserted.');

    // Insert sample customers
    const sampleCustomers = [
      ['Md. Rahman', '+880 1711-000001', 'rahman@example.com', 'Dhaka', 'Rahman Engineering', 'corporate', 200000, 'Net 30'],
      ['Farhan Ahmed', '+880 1811-000002', null, 'Dhaka', null, 'returning', 0, 'Net 15'],
      ['Tech Solutions Ltd', '+880 1911-000003', 'info@techsol.bd', 'Chittagong', 'Tech Solutions Ltd', 'corporate', 500000, 'Net 30'],
      ['Walk-in Customer', '', null, '', null, 'walk-in', 0, 'Net 15'],
    ];

    for (const c of sampleCustomers) {
      const exists = await client.query('SELECT id FROM customers WHERE name = $1', [c[0]]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO customers (name, phone, email, address, company, type, credit_limit, payment_terms)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          c
        );
      }
    }
    console.log('✅ Sample customers inserted.');

    // Insert sample suppliers
    const sampleSuppliers = [
      ['Bambu Lab', 'China', 'Sales Team', '+86-1234567890', 'sales@bambulab.com', '3D Printers, Filaments'],
      ['SUNLU', 'China', 'Export Dept', '+86-9876543210', 'export@sunlu.com', 'Filaments'],
      ['Harden Tools', 'China', 'Trade Dept', '+86-5555555555', 'trade@harden.com', 'Tools'],
      ['xTool', 'China', 'Distribution', '+86-4444444444', 'dist@xtool.com', 'Laser Engravers'],
      ['ABB Bangladesh', 'Bangladesh', 'Sales', '+880-1700000000', 'sales@abb.com.bd', 'Electrical Components'],
    ];

    for (const s of sampleSuppliers) {
      const exists = await client.query('SELECT id FROM suppliers WHERE name = $1', [s[0]]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO suppliers (name, country, contact_name, phone, email, products_supplied)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          s
        );
      }
    }
    console.log('✅ Sample suppliers inserted.');

    console.log('\n🎉 Database initialization complete!');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
