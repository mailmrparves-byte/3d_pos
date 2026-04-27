import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'postgres',
  database: 'postgres'
});

await client.connect();
const res = await client.query("SELECT 1 FROM pg_database WHERE datname='industrial3d_pos'");
if (res.rows.length > 0) {
  console.log('ℹ️  Database "industrial3d_pos" already exists.');
} else {
  await client.query('CREATE DATABASE industrial3d_pos');
  console.log('✅ Database "industrial3d_pos" created!');
}
await client.end();
console.log('Done.');
