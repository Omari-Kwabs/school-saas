const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { subject_id } = req.query;
  const params = [req.user.school_id];
  let q = `SELECT r.*, s.name AS subject_name
           FROM rubrics r
           LEFT JOIN subjects s ON s.id = r.subject_id
           WHERE r.school_id = $1`;
  if (subject_id) { params.push(subject_id); q += ` AND r.subject_id = $${params.length}`; }
  q += ' ORDER BY r.title';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', requirePrivilege('academic:read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, s.name AS subject_name
       FROM rubrics r LEFT JOIN subjects s ON s.id = r.subject_id
       WHERE r.id=$1 AND r.school_id=$2`,
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { title, subject_id, criteria, levels } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `INSERT INTO rubrics (school_id, subject_id, title, criteria, levels)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, subject_id || null, title, criteria || null, levels || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { title, subject_id, criteria, levels } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `UPDATE rubrics SET title=$1, subject_id=$2, criteria=$3, levels=$4
       WHERE id=$5 AND school_id=$6 RETURNING *`,
      [title, subject_id || null, criteria || null, levels || null,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM rubrics WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
