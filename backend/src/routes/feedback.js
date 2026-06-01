const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, assessment_id } = req.query;
  const params = [school_id];
  let q = `SELECT f.*, st.name AS student_name, u.name AS recorder_name,
                  a.title AS assessment_title, cb.name AS competency_name
           FROM feedback f
           JOIN students st ON st.id = f.student_id
           LEFT JOIN users u ON u.id = f.recorded_by
           LEFT JOIN assessments a ON a.id = f.assessment_id
           LEFT JOIN competency_benchmarks cb ON cb.id = f.competency_id
           WHERE f.school_id = $1`;
  if (student_id)    { params.push(student_id);    q += ` AND f.student_id    = $${params.length}`; }
  if (assessment_id) { params.push(assessment_id); q += ` AND f.assessment_id = $${params.length}`; }
  q += ' ORDER BY f.created_at DESC';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, assessment_id, competency_id, comment, action_required } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO feedback
         (school_id, student_id, assessment_id, competency_id, comment, action_required, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [school_id, student_id, assessment_id || null, competency_id || null,
       comment || null, action_required || null, recorded_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM feedback WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
