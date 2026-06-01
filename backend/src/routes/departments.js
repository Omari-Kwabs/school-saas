const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.*, u.name AS head_name
       FROM departments d
       LEFT JOIN users u ON u.id = d.head_id
       WHERE d.school_id = $1 ORDER BY d.name`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, head_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await pool.query(
      `INSERT INTO departments (school_id, name, head_id) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.school_id, name, head_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Department already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, head_id } = req.body;
  try {
    const r = await pool.query(
      `UPDATE departments SET name=$1, head_id=$2 WHERE id=$3 AND school_id=$4 RETURNING *`,
      [name, head_id || null, req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM departments WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /:id/members — list all teachers in a department
router.get('/:id/members', async (req, res) => {
  const { school_id } = req.user;
  try {
    const deptCheck = await pool.query(
      'SELECT id FROM departments WHERE id=$1 AND school_id=$2',
      [req.params.id, school_id]
    );
    if (!deptCheck.rows.length) return res.status(404).json({ error: 'Department not found' });

    const r = await pool.query(
      `SELECT id, name, role, email, is_active
       FROM users
       WHERE school_id=$1 AND department_id=$2
       ORDER BY name`,
      [school_id, req.params.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST /:id/members — assign a teacher to this department
router.post('/:id/members', requirePrivilege('classes:manage'), async (req, res) => {
  const { school_id } = req.user;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });

  try {
    const deptCheck = await pool.query(
      'SELECT id FROM departments WHERE id=$1 AND school_id=$2',
      [req.params.id, school_id]
    );
    if (!deptCheck.rows.length) return res.status(404).json({ error: 'Department not found' });

    const r = await pool.query(
      `UPDATE users SET department_id=$1
       WHERE id=$2 AND school_id=$3
         AND role IN ('teacher','class_teacher','department_head','headmaster_academics')
       RETURNING id, name, role`,
      [req.params.id, user_id, school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User not found or role not eligible for department membership' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /:id/members/:user_id — remove a teacher from this department
router.delete('/:id/members/:user_id', requirePrivilege('classes:manage'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const r = await pool.query(
      `UPDATE users SET department_id=NULL
       WHERE id=$1 AND school_id=$2 AND department_id=$3
       RETURNING id`,
      [req.params.user_id, school_id, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'User not found in this department' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
