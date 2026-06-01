const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async function auth(req, res, next) {
  // Accept token from httpOnly cookie (browser) or Authorization header (API clients)
  const cookieToken = req.cookies?.auth_token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Verify token_version to catch privilege/role changes that happened after login.
  // system_admin tokens don't carry school_id or token_version — skip check.
  if (req.user.role !== 'system_admin' && req.user.school_id) {
    const tokenVersion = req.user.token_version ?? 0;
    try {
      const { rows } = await pool.query(
        'SELECT token_version FROM users WHERE id=$1 AND school_id=$2',
        [req.user.id, req.user.school_id]
      );
      if (!rows.length || rows[0].token_version !== tokenVersion) {
        return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      }
    } catch {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  next();
};
