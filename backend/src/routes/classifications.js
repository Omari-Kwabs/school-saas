const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.name AS head_teacher_name
       FROM classifications c
       LEFT JOIN users u ON u.id = c.head_teacher_id
       WHERE c.school_id = $1 ORDER BY c.name`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, head_teacher_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await pool.query(
      `INSERT INTO classifications (school_id, name, head_teacher_id) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.school_id, name, head_teacher_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Classification already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, head_teacher_id } = req.body;
  try {
    const r = await pool.query(
      `UPDATE classifications SET name=$1, head_teacher_id=$2 WHERE id=$3 AND school_id=$4 RETURNING *`,
      [name, head_teacher_id || null, req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM classifications WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
