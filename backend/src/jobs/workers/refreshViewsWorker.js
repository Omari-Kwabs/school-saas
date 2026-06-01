const { Worker } = require('bullmq');
const pool = require('../../config/db');
const { connection } = require('../queue');

const refreshViewsWorker = new Worker('analytics-views', async () => {
  await pool.query(`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grade_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_subject_averages;
  `);
  console.log('Analytics views refreshed at', new Date().toISOString());
}, { connection });

refreshViewsWorker.on('failed', (job, err) => {
  console.error('Analytics view refresh failed:', err.message);
});

module.exports = refreshViewsWorker;
