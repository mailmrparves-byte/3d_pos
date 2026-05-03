import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    console.log('Migrating database...');
    await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(14,2) DEFAULT 0');
    await pool.query('ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(14,2) DEFAULT 0');
    
    // Also add settings for custom template
    // template_config will store the coordinates of the blocks
    await pool.query("INSERT INTO settings (category, key, value) VALUES ('invoice', 'template_background', '') ON CONFLICT DO NOTHING");
    await pool.query("INSERT INTO settings (category, key, value) VALUES ('invoice', 'template_config', '{}') ON CONFLICT DO NOTHING");
    await pool.query("INSERT INTO settings (category, key, value) VALUES ('invoice', 'use_custom_template', 'false') ON CONFLICT DO NOTHING");

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
