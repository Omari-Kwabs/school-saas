const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  const { school_id } = req.user;
  const { subject_id } = req.query;
  const params = [school_id];
  let q = `SELECT cb.*, s.name AS subject_name
           FROM competency_benchmarks cb
           LEFT JOIN subjects s ON s.id = cb.subject_id
           WHERE cb.school_id = $1`;
  if (subject_id) { params.push(subject_id); q += ` AND cb.subject_id = $${params.length}`; }
  q += ' ORDER BY cb.name';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT cb.*, s.name AS subject_name
       FROM competency_benchmarks cb
       LEFT JOIN subjects s ON s.id = cb.subject_id
       WHERE cb.id = $1 AND cb.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { name, subject_id, expected_level } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      `INSERT INTO competency_benchmarks (school_id, subject_id, name, expected_level)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.school_id, subject_id || null, name, expected_level || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { name, subject_id, expected_level } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      `UPDATE competency_benchmarks SET name=$1, subject_id=$2, expected_level=$3
       WHERE id=$4 AND school_id=$5 RETURNING *`,
      [name, subject_id || null, expected_level || null, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM competency_benchmarks WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
