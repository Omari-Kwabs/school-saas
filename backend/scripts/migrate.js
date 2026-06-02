require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 10000,
});

const DIR = path.join(__dirname, '../migrations');

// Non-fatal migrations — log errors but don't abort startup
const OPTIONAL = new Set([
  'optimize_indexes_20260530.sql',
  'partition_attendance.sql',
  'partition_audit_logs.sql',
]);

// Explicit order — schema must come first, then extensions in sequence
const MIGRATIONS = [
  'schema.sql',
  'extend_schema.sql',
  ...Array.from({ length: 19 }, (_, i) => `extend_schema${i + 2}.sql`),
  'add_plan_pricing.sql',
  'system_admin.sql',
  'optimize_indexes_20260530.sql',
  'partition_attendance.sql',
  'partition_audit_logs.sql',
].filter(f => fs.existsSync(path.join(DIR, f)));

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    for (const file of MIGRATIONS) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1', [file]
      );
      if (rows.length > 0) {
        console.log(`skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
      console.log(`apply ${file} ...`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓ done`);
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        if (OPTIONAL.has(file)) {
          console.warn(`  ⚠ skipped (optional): ${err.message}`);
        } else {
          console.error(`  ✗ failed: ${err.message}`);
          // Mark as applied anyway to avoid repeated failure on restart
          try {
            await client.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
          } catch (_) {}
        }
      }
    }

    console.log('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration error:', err.message);
  // Non-fatal — let the server start so we can see errors from real requests
});
