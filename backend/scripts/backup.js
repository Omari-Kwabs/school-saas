/**
 * Backup script: pg_dump → gzip → Cloudflare R2 / S3.
 *
 * Run manually:  node backend/scripts/backup.js
 * Or called by:  backend/src/jobs/workers/backupWorker.js (BullMQ scheduled job)
 *
 * Requires: DATABASE_URL, R2_* env vars (see .env.example)
 * Retention:  configure an R2/S3 lifecycle rule to expire objects under
 *             the 'backups/' prefix after BACKUP_RETENTION_DAYS (default 7).
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { spawn }     = require('child_process');
const zlib          = require('zlib');
const { uploadFile, isConfigured } = require('../src/lib/storage');

async function runBackup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  if (!isConfigured())           throw new Error('File storage (R2/S3) is not configured — set R2_* env vars');

  const now      = new Date();
  const stamp    = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-05-16T02-00-00
  const filename = `backup-${stamp}.sql.gz`;

  console.log(`[backup] Starting pg_dump → ${filename}`);

  const chunks = [];

  await new Promise((resolve, reject) => {
    const pg = spawn('pg_dump', ['--no-password', process.env.DATABASE_URL], {
      env: { ...process.env, PGPASSWORD: '' },
    });

    const gz = zlib.createGzip();
    pg.stdout.pipe(gz);

    pg.stderr.on('data', d => {
      const msg = d.toString().trim();
      if (msg) console.warn('[backup] pg_dump stderr:', msg);
    });

    gz.on('data', chunk => chunks.push(chunk));
    gz.on('end',  resolve);
    gz.on('error', reject);
    pg.on('error', reject);
    pg.on('close', code => {
      if (code !== 0) reject(new Error(`pg_dump exited with code ${code}`));
    });
  });

  const buffer = Buffer.concat(chunks);
  console.log(`[backup] Compressed size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  const url = await uploadFile(buffer, 'backups', 'application/gzip', filename);
  console.log(`[backup] Uploaded: ${url}`);

  return { filename, bytes: buffer.length, url };
}

// Allow direct invocation
if (require.main === module) {
  runBackup()
    .then(r => { console.log('[backup] Done:', r); process.exit(0); })
    .catch(err => { console.error('[backup] Failed:', err.message); process.exit(1); });
}

module.exports = { runBackup };
