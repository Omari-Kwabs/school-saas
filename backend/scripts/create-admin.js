/**
 * Creates the initial system admin account.
 * Run once: node scripts/create-admin.js
 *
 * Default credentials:
 *   Email:    superadmin@schoolsaas.com
 *   Password: Admin@SchoolSaaS2025
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool   = require('../src/config/db');

const EMAIL    = process.env.ADMIN_EMAIL    || 'superadmin@schoolsaas.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@SchoolSaaS2025';
const NAME     = process.env.ADMIN_NAME     || 'System Administrator';

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_admins (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const hash = await bcrypt.hash(PASSWORD, 10);

  const res = await pool.query(
    `INSERT INTO system_admins (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING id, name, email`,
    [NAME, EMAIL, hash]
  );

  console.log('System admin account ready:');
  console.log('  ID:    ', res.rows[0].id);
  console.log('  Name:  ', res.rows[0].name);
  console.log('  Email: ', res.rows[0].email);
  console.log('  Pass:  ', PASSWORD);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
