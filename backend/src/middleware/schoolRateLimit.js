const rateLimit = require('express-rate-limit');

// Per-school rate limiter keyed by school_id (not IP).
// Uses in-memory store — sufficient for a single-process deployment.
// When scaling to multiple processes, add the Redis adapter (see Socket.io TODO in index.js).

const schoolLimiter = rateLimit({
  windowMs: 60_000,   // 1 minute window
  max: 300,           // 300 requests per school per minute
  keyGenerator: (req) => `school:${req.school?.id || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Rate limit exceeded for this school. Please slow down.' },
  skip: (req) => req.user?.role === 'system_admin',
});

module.exports = schoolLimiter;
