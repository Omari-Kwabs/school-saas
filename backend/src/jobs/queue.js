const { Queue } = require('bullmq');
const Redis = require('ioredis');

// BullMQ expects host/port, not a URL string
function parseRedisUrl(url) {
  try {
    const u = new URL(url || 'redis://localhost:6379');
    return { host: u.hostname, port: parseInt(u.port) || 6379 };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(process.env.REDIS_URL);

// Shared ioredis client — exported for modules that need direct Redis access (e.g. system-health).
// enableOfflineQueue: false and maxRetriesPerRequest: 0 ensure commands fail fast
// rather than queueing when Redis is temporarily unreachable.
const redisClient = new Redis({
  ...connection,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
});
redisClient.on('error', () => {}); // suppress unhandled error events when Redis is absent

const reportQueue = new Queue('reports', { connection });
const viewsQueue  = new Queue('analytics-views', { connection });
const backupQueue = new Queue('backups', { connection });

module.exports = { reportQueue, viewsQueue, backupQueue, connection, redisClient };
