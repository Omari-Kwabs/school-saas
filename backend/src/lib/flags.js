const pool = require('../config/db');

let redis = null;
if (process.env.REDIS_URL) {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL);
  redis.on('error', err => console.error('Redis (flags):', err.message));
}

const FLAG_TTL = 60; // 1-minute cache for flags

/**
 * Check whether a feature flag is enabled for a school.
 * School-level flag takes precedence over global flag.
 * Returns false if the flag doesn't exist.
 */
async function isEnabled(school_id, flag_name) {
  const cacheKey = `flag:${school_id}:${flag_name}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null) return cached === '1';
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  const { rows } = await pool.query(
    `SELECT enabled FROM feature_flags
     WHERE flag_name = $1
       AND (school_id = $2 OR school_id IS NULL)
     ORDER BY school_id NULLS LAST
     LIMIT 1`,
    [flag_name, school_id]
  );

  const enabled = rows.length > 0 ? rows[0].enabled : false;

  if (redis) {
    redis.setex(cacheKey, FLAG_TTL, enabled ? '1' : '0').catch(() => {});
  }

  return enabled;
}

/**
 * Get all flags for a school (school-level + global, school takes precedence).
 */
async function getAllFlags(school_id) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (flag_name) flag_name, enabled
     FROM feature_flags
     WHERE school_id = $1 OR school_id IS NULL
     ORDER BY flag_name, school_id NULLS LAST`,
    [school_id]
  );
  return Object.fromEntries(rows.map(r => [r.flag_name, r.enabled]));
}

/**
 * Invalidate cached flags for a school after a flag change.
 */
function invalidateFlags(school_id, flag_name) {
  if (redis) {
    const key = `flag:${school_id}:${flag_name}`;
    redis.del(key).catch(() => {});
  }
}

module.exports = { isEnabled, getAllFlags, invalidateFlags };
