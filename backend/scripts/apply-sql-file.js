const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-sql-file.js <path-to-sql>');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), file);
const sql = fs.readFileSync(sqlPath, 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

pool.query(sql)
  .then(() => {
    console.log(`Applied ${file}`);
  })
  .catch(err => {
    console.error(`Failed to apply ${file}:`, err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
