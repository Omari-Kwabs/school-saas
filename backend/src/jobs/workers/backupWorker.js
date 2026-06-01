const { Worker } = require('bullmq');
const { connection, backupQueue } = require('../queue');
const { runBackup } = require('../../../scripts/backup');

// Schedule a daily backup at 02:00 UTC (repeatable job, idempotent)
backupQueue.add(
  'daily-backup',
  {},
  {
    repeat: { pattern: '0 2 * * *' }, // cron: 2 AM every day
    jobId: 'daily-backup',            // stable ID prevents duplicate schedules on restart
  }
).catch(err => console.error('[backupWorker] Failed to schedule job:', err.message));

const worker = new Worker(
  'backups',
  async (job) => {
    console.log(`[backupWorker] Running backup job ${job.id}`);
    const result = await runBackup();
    return result;
  },
  { connection, concurrency: 1 }
);

worker.on('completed', (job, result) => {
  console.log(`[backupWorker] Job ${job.id} completed — ${result.filename} (${(result.bytes / 1024 / 1024).toFixed(2)} MB)`);
});
worker.on('failed', (job, err) => {
  console.error(`[backupWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = worker;
