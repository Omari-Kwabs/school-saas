const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  const { school_id } = req.user;
  const { student_id, subject_id } = req.query;
  const params = [school_id];
  let q = `SELECT sa.*, st.name AS student_name, s.name AS subject_name
           FROM self_assessments sa
           JOIN students st ON st.id = sa.student_id
           LEFT JOIN subjects s ON s.id = sa.subject_id
           WHERE sa.school_id = $1`;
  if (student_id) { params.push(student_id); q += ` AND sa.student_id = $${params.length}`; }
  if (subject_id) { params.push(subject_id); q += ` AND sa.subject_id = $${params.length}`; }
  q += ' ORDER BY sa.created_at DESC';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, subject_id, reflection, confidence_level } = req.body;
  const { school_id } = req.user;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO self_assessments
         (school_id, student_id, subject_id, reflection, confidence_level)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [school_id, student_id, subject_id || null, reflection || null, confidence_level || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM self_assessments WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
