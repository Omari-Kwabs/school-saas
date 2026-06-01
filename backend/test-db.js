const defaultDbUrl = 'postgresql://user:password@localhost:5432/school_saas';
process.env.DATABASE_URL = process.env.DATABASE_URL || defaultDbUrl;
console.log('DB test started:', process.env.DATABASE_URL);
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1')
  .then(r => { console.log('OK', process.env.DATABASE_URL); pool.end(); })
  .catch(e => { console.error('ERROR', e); pool.end(); process.exit(1); });
