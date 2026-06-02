/**
 * Runs seed.js only when the database has no schools yet.
 * Safe to call on every deploy — skips automatically if data exists.
 */
require('dotenv').config();
const { Pool }     = require('pg');
const { spawnSync } = require('child_process');
const path          = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 10000,
});

async function main() {
  const client = await pool.connect();
  let isEmpty = false;
  try {
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM schools');
    isEmpty = parseInt(rows[0].count, 10) === 0;
  } finally {
    client.release();
    await pool.end();
  }

  if (!isEmpty) {
    console.log('Seed: skipping — school data already exists.');
    return;
  }

  console.log('Seed: empty database detected — seeding demo data...');
  const result = spawnSync('node', ['seed.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    console.error('Seed: failed — server will still start.');
  }
}

main().catch(err => {
  // Non-fatal: log and allow server to start
  console.error('Seed check error:', err.message);
});
