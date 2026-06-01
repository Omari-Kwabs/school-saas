const pool = require('../config/db');

let redis = null;
if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL);
  redis.on('error', err => console.error('Redis (tenant cache):', err.message));
}

const CACHE_TTL = 300; // 5 minutes

// Runs after auth middleware.
// Verifies the school exists, checks plan/trial validity,
// and attaches req.school so routes never need to re-query it.
module.exports = async function tenant(req, res, next) {
  // System admins operate across all schools — no tenant context needed
  if (req.user.role === 'system_admin') return next();

  const { school_id } = req.user;

  // Try Redis cache first (school metadata changes rarely)
  if (redis) {
    try {
      const cached = await redis.get(`school:${school_id}`);
      if (cached) {
        req.school = JSON.parse(cached);
        return next();
      }
    } catch {
      // Cache miss or Redis error — fall through to DB
    }
  }

  try {
    const result = await pool.query(
      'SELECT id, name, plan, trial_end_date FROM schools WHERE id = $1',
      [school_id]
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: 'School not found' });
    }
    const school = result.rows[0];

    // Enforce trial expiry — only blocks if on trial plan and date has passed
    if (school.plan === 'trial' && school.trial_end_date) {
      const expired = new Date(school.trial_end_date) < new Date();
      if (expired) {
        return res.status(403).json({ error: 'Trial period has ended. Please upgrade your plan.' });
      }
    }

    // Cache school metadata (don't cache expired-trial schools to allow rapid retry)
    if (redis) {
      redis.setex(`school:${school_id}`, CACHE_TTL, JSON.stringify(school)).catch(() => {});
    }

    req.school = school;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Export cache invalidation helper so school-update routes can bust it
module.exports.invalidate = function invalidateSchoolCache(school_id) {
  if (redis) redis.del(`school:${school_id}`).catch(() => {});
};
