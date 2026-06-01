const { Worker, Queue } = require('bullmq');
const { connection } = require('../queue');
const pool = require('../../config/db');

const purgeQueue = new Queue('audit-purge', { connection });

// Schedule a monthly purge on the 1st of each month at 03:00 UTC
purgeQueue.add(
  'monthly-purge',
  {},
  {
    repeat: { pattern: '0 3 1 * *' },
    jobId: 'monthly-audit-purge',
  }
).catch(err => console.error('[auditPurgeWorker] Failed to schedule job:', err.message));

const worker = new Worker(
  'audit-purge',
  async (job) => {
    const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '730', 10);
    console.log(`[auditPurgeWorker] Purging audit_logs older than ${retentionDays} days`);

    const { rowCount } = await pool.query(
      `DELETE FROM audit_logs
       WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [retentionDays]
    );

    console.log(`[auditPurgeWorker] Deleted ${rowCount} old audit log rows`);
    return { deleted: rowCount };
  },
  { connection, concurrency: 1 }
);

worker.on('completed', (job, result) => {
  console.log(`[auditPurgeWorker] Job ${job.id} completed — deleted ${result.deleted} rows`);
});
worker.on('failed', (job, err) => {
  console.error(`[auditPurgeWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = worker;
