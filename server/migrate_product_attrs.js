import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'Pcs',
      ADD COLUMN IF NOT EXISTS weight VARCHAR(50),
      ADD COLUMN IF NOT EXISTS size VARCHAR(50),
      ADD COLUMN IF NOT EXISTS color VARCHAR(50),
      ADD COLUMN IF NOT EXISTS is_liquid BOOLEAN DEFAULT false
    `);
    console.log('✅ Migration complete: added product attributes (unit, weight, size, color, is_liquid)');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
