const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, status } = req.query;
  const params = [school_id];
  let q = `SELECT rf.*, st.name AS student_name, cb.name AS competency_name
           FROM remediation_flags rf
           JOIN students st ON st.id = rf.student_id
           LEFT JOIN competency_benchmarks cb ON cb.id = rf.competency_id
           WHERE rf.school_id = $1`;
  if (student_id) { params.push(student_id); q += ` AND rf.student_id = $${params.length}`; }
  if (status)     { params.push(status);     q += ` AND rf.status     = $${params.length}`; }
  q += ' ORDER BY rf.created_at DESC';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, competency_id, reason } = req.body;
  const { school_id } = req.user;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO remediation_flags (school_id, student_id, competency_id, reason)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [school_id, student_id, competency_id || null, reason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/status', requirePrivilege('academic:write'), async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });
  try {
    const result = await pool.query(
      'UPDATE remediation_flags SET status=$1 WHERE id=$2 AND school_id=$3 RETURNING *',
      [status, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM remediation_flags WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
