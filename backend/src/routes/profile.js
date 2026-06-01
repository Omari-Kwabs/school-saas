const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const router = express.Router();

router.get('/me', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, name, email, role, is_active, created_at, signature_data FROM users WHERE id=$1 AND school_id=$2',
      [req.user.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Save/update own signature (base64 PNG string)
router.put('/me/signature', async (req, res) => {
  const { signature_data } = req.body;
  try {
    await pool.query(
      'UPDATE users SET signature_data=$1 WHERE id=$2 AND school_id=$3',
      [signature_data || null, req.user.id, req.user.school_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Return all school staff with signatures for stamping documents
// Includes name, role, signature_data for users who have signed
router.get('/signatories', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, role, signature_data
       FROM users
       WHERE school_id=$1 AND is_active=true
         AND role != 'student'
       ORDER BY
         CASE role
           WHEN 'owner'               THEN 1
           WHEN 'headmaster_academics' THEN 2
           WHEN 'headmaster_admin'    THEN 3
           WHEN 'department_head'     THEN 4
           WHEN 'class_teacher'       THEN 5
           WHEN 'teacher'             THEN 6
           ELSE 7
         END, name`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/me', async (req, res) => {
  if (req.user.role === 'system_admin') {
    return res.status(403).json({ error: 'System admins cannot update their profile via this endpoint' });
  }
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await pool.query(
      'UPDATE users SET name=$1 WHERE id=$2 AND school_id=$3 RETURNING id, name, email, role',
      [name, req.user.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/me/password', async (req, res) => {
  if (req.user.role === 'system_admin') {
    return res.status(403).json({ error: 'System admins cannot change their password via this endpoint' });
  }
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  try {
    const r = await pool.query(
      'SELECT password_hash FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(current_password, r.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
