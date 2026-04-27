import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

// Connect to default 'postgres' database to create our DB
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: process.env.PG_SUPERUSER_PASSWORD || 'postgres',
  database: 'postgres'
});

async function createDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Check if DB exists
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'industrial3d_pos'");
    if (res.rows.length > 0) {
      console.log('ℹ️  Database "industrial3d_pos" already exists — skipping creation');
    } else {
      await client.query('CREATE DATABASE industrial3d_pos');
      console.log('✅ Database "industrial3d_pos" created!');
    }
    await client.end();
    console.log('\n✅ Database ready! Now running schema initialization...\n');
    
    // Now run the main init
    const { default: initDb } = await import('./initDb.js');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    console.log('\n⚠️  If this is a password error, edit server/.env and set:');
    console.log('   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/industrial3d_pos');
    console.log('   Then run: node config/createDb.js');
    await client.end().catch(() => {});
    process.exit(1);
  }
}

createDatabase();
