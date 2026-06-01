require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const seedRoles = require('../utils/seedRoles');
const { getAllFlags } = require('../lib/flags');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const meLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function fetchPrivileges(school_id, role) {
  const res = await pool.query(
    `SELECT rp.privilege FROM role_privileges rp
     JOIN school_roles sr ON sr.id = rp.role_id
     WHERE sr.school_id = $1 AND sr.name = $2`,
    [school_id, role]
  );
  return res.rows.map(r => r.privilege);
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
}

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2 * 60 * 60 * 1000, // 2 hours in ms
};

function setAuthCookie(res, token) {
  res.cookie('auth_token', token, COOKIE_OPTS);
}

router.post('/register', registerLimiter, async (req, res) => {
  const {
    school_name, school_code, school_address, school_phone, school_email,
    owner_name, owner_email, owner_password,
  } = req.body;
  const plan = 'trial';

  if (!school_name || !school_code || !owner_name || !owner_email || !owner_password) {
    return res.status(400).json({ error: 'school_name, school_code, owner_name, owner_email, owner_password required' });
  }
  if (owner_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const trial_end_date = new Date();
  trial_end_date.setDate(trial_end_date.getDate() + 122);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schoolRes = await client.query(
      `INSERT INTO schools (name, code, address, phone, email, plan, trial_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, plan`,
      [school_name, school_code, school_address, school_phone, school_email,
       plan, plan === 'trial' ? trial_end_date : null]
    );
    const school = schoolRes.rows[0];

    const hash = await bcrypt.hash(owner_password, 10);
    const userRes = await client.query(
      `INSERT INTO users (school_id, name, email, username, password_hash, role)
       VALUES ($1, $2, $3, $3, $4, 'owner') RETURNING id, name, role, token_version`,
      [school.id, owner_name, owner_email, hash]
    );

    await seedRoles(client, school.id);
    await client.query('COMMIT');

    const user = userRes.rows[0];
    const privileges = await fetchPrivileges(school.id, 'owner');
    const token = signToken({
      id: user.id, school_id: school.id, role: user.role,
      name: user.name, school_name: school.name, privileges,
      token_version: user.token_version,
    });
    setAuthCookie(res, token);
    res.status(201).json({ token, school: { id: school.id, name: school.name, plan: school.plan } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'School code or email already exists' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { school_code, username, email, password } = req.body;
  const identifier = username || email;
  if (!school_code || !identifier || !password) {
    return res.status(400).json({ error: 'school_code, username, and password required' });
  }
  try {
    const schoolRes = await pool.query(
      'SELECT id, name, plan, trial_end_date FROM schools WHERE code = $1',
      [school_code]
    );
    if (!schoolRes.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const school = schoolRes.rows[0];

    const userRes = await pool.query(
      'SELECT id, name, role, password_hash, token_version FROM users WHERE school_id = $1 AND (username = $2 OR email = $2) AND is_active = true',
      [school.id, identifier]
    );
    if (!userRes.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    let privileges = await fetchPrivileges(school.id, user.role);
    if (!privileges.length) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        await seedRoles(c, school.id);
        await c.query('COMMIT');
        privileges = await fetchPrivileges(school.id, user.role);
      } catch {
        await c.query('ROLLBACK').catch(() => {});
      } finally {
        c.release();
      }
    }

    const tokenPayload = {
      id: user.id, school_id: school.id, role: user.role,
      name: user.name, school_name: school.name,
      token_version: user.token_version,
    };
    if (privileges.length) tokenPayload.privileges = privileges;

    const token = signToken(tokenPayload);
    setAuthCookie(res, token);
    res.json({
      token,
      user:   { id: user.id, name: user.name, role: user.role },
      school: { id: school.id, name: school.name, plan: school.plan, trial_end_date: school.trial_end_date },
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System admin login — no school_code required
router.post('/admin-login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT id, name, password_hash FROM system_admins WHERE email = $1 AND is_active = true',
      [email]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken({ id: admin.id, role: 'system_admin', name: admin.name });
    pool.query(
      `INSERT INTO audit_logs (action, entity, entity_id, meta, ip)
       VALUES ('admin_login', 'system_admin', $1, $2, $3)`,
      [admin.id, JSON.stringify({ name: admin.name }), req.ip]
    ).catch(() => {});
    setAuthCookie(res, token);
    res.json({ token, admin: { id: admin.id, name: admin.name } });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Re-issue a fresh token and refresh the cookie (extends session).
router.post('/refresh', meLimiter, async (req, res) => {
  const cookieToken = req.cookies?.auth_token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) return res.status(401).json({ error: 'No token provided' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  try {
    const { id, school_id, role } = decoded;

    if (role === 'system_admin') {
      const result = await pool.query(
        'SELECT id, name FROM system_admins WHERE id=$1 AND is_active=true',
        [id]
      );
      if (!result.rows.length) return res.status(401).json({ error: 'Account inactive' });
      const newToken = signToken({ id, role: 'system_admin', name: result.rows[0].name });
      setAuthCookie(res, newToken);
      return res.json({ token: newToken });
    }

    const userRes = await pool.query(
      'SELECT id, name, role, is_active, token_version FROM users WHERE id=$1 AND school_id=$2',
      [id, school_id]
    );
    if (!userRes.rows.length || !userRes.rows[0].is_active) {
      return res.status(401).json({ error: 'Account inactive' });
    }
    const user = userRes.rows[0];
    const schoolRes = await pool.query('SELECT name FROM schools WHERE id=$1', [school_id]);
    const school_name = schoolRes.rows[0]?.name || '';
    const privileges = await fetchPrivileges(school_id, role);
    const newToken = signToken({ id, school_id, role, name: user.name, school_name, privileges, token_version: user.token_version });
    setAuthCookie(res, newToken);
    res.json({ token: newToken });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear the auth cookie and end the session
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ success: true });
});

// Return current user context — used by frontend on startup instead of decoding JWT
router.get('/me', meLimiter, async (req, res) => {
  const cookieToken = req.cookies?.auth_token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;

  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach feature flags so frontend can gate features without extra API calls
  if (decoded.school_id) {
    try {
      decoded.flags = await getAllFlags(decoded.school_id);
    } catch {
      decoded.flags = {};
    }
  }

  res.json(decoded);
});

module.exports = router;
