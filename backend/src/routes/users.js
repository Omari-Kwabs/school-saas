const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');

const router = express.Router();
router.use(requirePrivilege('users:manage'));

const VALID_ROLES = [
  'owner','teacher','class_teacher','department_head',
  'headmaster_academics','headmaster_admin','accountant','bursar',
];

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, username, email, role, is_active, created_at FROM users WHERE school_id = $1 ORDER BY name',
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, email, username, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  const resolvedUsername = (username || email).trim().toLowerCase();
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (school_id, name, email, username, password_hash, role)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, username, email, role, is_active`,
      [req.user.school_id, name, email, resolvedUsername, hash, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email or username already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, role, is_active } = req.body;
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }
  try {
    // Increment token_version when role or active status changes to invalidate existing sessions
    const current = await pool.query(
      'SELECT role, is_active FROM users WHERE id=$1 AND school_id=$2',
      [req.params.id, req.user.school_id]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Not found' });

    const roleChanged = role !== undefined && role !== current.rows[0].role;
    const activeChanged = is_active !== undefined && is_active !== current.rows[0].is_active;
    const versionBump = (roleChanged || activeChanged) ? ', token_version = token_version + 1' : '';

    const result = await pool.query(
      `UPDATE users SET name=$1, role=$2, is_active=$3${versionBump}
       WHERE id=$4 AND school_id=$5 RETURNING id, name, email, role, is_active`,
      [name, role, is_active, req.params.id, req.user.school_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 AND school_id = $2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    audit(req, 'DEACTIVATE', 'user', req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset any user's password (owner only — already enforced by router.use above)
router.put('/:id/reset-password', async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' });
  }
  try {
    const hash = await bcrypt.hash(new_password, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2 AND school_id=$3 RETURNING id, name',
      [hash, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    audit(req, 'RESET_PASSWORD', 'user', req.params.id, { name: result.rows[0].name });
    res.json({ success: true, message: `Password reset for ${result.rows[0].name}` });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
