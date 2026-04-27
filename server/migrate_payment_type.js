import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    await pool.query('ALTER TABLE sales ALTER COLUMN payment_method TYPE TEXT');
    console.log('✅ Migration complete: payment_method column type changed to TEXT');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
