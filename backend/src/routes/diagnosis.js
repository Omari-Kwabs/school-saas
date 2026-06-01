const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

// List diagnostic results
router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, assessment_id } = req.query;
  const params = [school_id];
  let q = `SELECT dr.*, st.name AS student_name,
                  a.title AS assessment_title, cb.name AS competency_name
           FROM diagnostic_results dr
           JOIN students            st ON st.id = dr.student_id
           JOIN assessments          a ON a.id  = dr.assessment_id
           JOIN competency_benchmarks cb ON cb.id = dr.competency_id
           WHERE dr.school_id = $1`;
  if (student_id)    { params.push(student_id);    q += ` AND dr.student_id    = $${params.length}`; }
  if (assessment_id) { params.push(assessment_id); q += ` AND dr.assessment_id = $${params.length}`; }
  q += ' ORDER BY st.name, a.title, cb.name';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Auto-flag a student for remediation when they reach LOW_THRESHOLD low results
// on the same competency. Skips silently if a flag already exists (pending/in_progress).
const LOW_THRESHOLD = 2;

async function autoFlag(school_id, student_id, competency_id) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM diagnostic_results
     WHERE school_id=$1 AND student_id=$2 AND competency_id=$3 AND level='low'`,
    [school_id, student_id, competency_id]
  );
  if (rows[0].cnt < LOW_THRESHOLD) return;

  const existing = await pool.query(
    `SELECT id FROM remediation_flags
     WHERE school_id=$1 AND student_id=$2 AND competency_id=$3
       AND status IN ('pending','in_progress')`,
    [school_id, student_id, competency_id]
  );
  if (existing.rows.length) return;

  await pool.query(
    `INSERT INTO remediation_flags (school_id, student_id, competency_id, reason)
     VALUES ($1,$2,$3,$4)`,
    [school_id, student_id, competency_id,
     `Auto-flagged: ${rows[0].cnt} consecutive low diagnostic results`]
  );
}

// Record a diagnostic result (competency-level evaluation for a student on an assessment)
router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, assessment_id, competency_id, level } = req.body;
  const { school_id } = req.user;
  if (!student_id || !assessment_id || !competency_id) {
    return res.status(400).json({ error: 'student_id, assessment_id, competency_id required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO diagnostic_results (school_id, student_id, assessment_id, competency_id, level)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [school_id, student_id, assessment_id, competency_id, level || null]
    );
    if (level === 'low') {
      autoFlag(school_id, student_id, competency_id).catch(() => {});
    }
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Delete a diagnostic result
router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM diagnostic_results WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
