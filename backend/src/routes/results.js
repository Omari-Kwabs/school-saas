const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { getTeacherScope, SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();

// Resolves the subject_id and class_id for a given assessment_id.
// Returns null if not found.
async function getAssessmentScope(assessmentId, schoolId) {
  const { rows } = await pool.query(
    'SELECT subject_id, class_id FROM assessments WHERE id=$1 AND school_id=$2',
    [assessmentId, schoolId]
  );
  return rows[0] || null;
}

// Throws a 403-style error object if a scoped teacher is not assigned to this
// assessment's subject+class. No-op for admin roles.
async function assertTeacherCanRecordAssessment(user, assessmentId) {
  if (!SCOPED_ROLES.has(user.role)) return;
  const aScope = await getAssessmentScope(assessmentId, user.school_id);
  if (!aScope) throw { status: 400, error: 'Assessment not found' };
  const scope = await getTeacherScope(user);
  if (scope && !scope.isTeacherOf(aScope.class_id, aScope.subject_id)) {
    throw { status: 403, error: 'You are not assigned to teach this subject in this class' };
  }
}

// POST — enter or update a single result
router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, assessment_id, score_theory, score_practical } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id || !assessment_id) {
    return res.status(400).json({ error: 'student_id and assessment_id required' });
  }
  try {
    await assertTeacherCanRecordAssessment(req.user, assessment_id);
    const scoreT = score_theory    != null ? parseFloat(score_theory)    : null;
    const scoreP = score_practical != null ? parseFloat(score_practical) : null;
    const total  = scoreT != null && scoreP != null ? scoreT + scoreP
                 : scoreT ?? scoreP ?? null;
    const result = await pool.query(
      `INSERT INTO results
         (school_id, student_id, assessment_id, score_theory, score_practical, total_score, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (school_id, student_id, assessment_id)
       DO UPDATE SET score_theory=$4, score_practical=$5, total_score=$6, recorded_by=$7
       RETURNING *`,
      [school_id, student_id, assessment_id, scoreT, scoreP, total, recorded_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bulk — enter results for multiple students on one assessment
router.post('/bulk', requirePrivilege('academic:write'), async (req, res) => {
  const { assessment_id, records } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!assessment_id || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'assessment_id and records array required' });
  }
  try {
    await assertTeacherCanRecordAssessment(req.user, assessment_id);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    return res.status(500).json({ error: 'Internal server error' });
  }
  // Build all rows first, then insert in a single statement
  const rows = [];
  for (const r of records) {
    if (!r.student_id) continue;
    const scoreT = r.score_theory    != null ? parseFloat(r.score_theory)    : null;
    const scoreP = r.score_practical != null ? parseFloat(r.score_practical) : null;
    const total  = scoreT != null && scoreP != null ? scoreT + scoreP
                 : scoreT ?? scoreP ?? null;
    rows.push([school_id, r.student_id, assessment_id, scoreT, scoreP, total, recorded_by]);
  }
  if (!rows.length) return res.json({ success: true, count: 0 });

  const placeholders = rows.map((_, i) => {
    const b = i * 7;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`;
  }).join(',');

  try {
    await pool.query(
      `INSERT INTO results
         (school_id, student_id, assessment_id, score_theory, score_practical, total_score, recorded_by)
       VALUES ${placeholders}
       ON CONFLICT (school_id, student_id, assessment_id)
       DO UPDATE SET score_theory    = EXCLUDED.score_theory,
                     score_practical = EXCLUDED.score_practical,
                     total_score     = EXCLUDED.total_score,
                     recorded_by     = EXCLUDED.recorded_by`,
      rows.flat()
    );
    res.json({ success: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET — list results with optional filters
router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, assessment_id, class_id, term_id } = req.query;
  const params = [school_id];
  let q = `SELECT r.*, st.name AS student_name, st.student_code,
                  a.title AS assessment_title, a.type AS assessment_type, a.max_score,
                  s.name AS subject_name, t.name AS term_name
           FROM results r
           JOIN students    st ON st.id = r.student_id
           JOIN assessments a  ON a.id  = r.assessment_id
           LEFT JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN terms    t ON t.id = a.term_id
           WHERE r.school_id = $1`;
  if (student_id)    { params.push(student_id);    q += ` AND r.student_id    = $${params.length}`; }
  if (assessment_id) { params.push(assessment_id); q += ` AND r.assessment_id = $${params.length}`; }
  if (class_id)      { params.push(class_id);      q += ` AND st.class_id     = $${params.length}`; }
  if (term_id)       { params.push(term_id);       q += ` AND a.term_id       = $${params.length}`; }
  q += ' ORDER BY st.name, a.title';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /student/:id — all results for a student
router.get('/student/:student_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  const params = [school_id, req.params.student_id];
  let q = `SELECT r.*, a.title AS assessment_title, a.type AS assessment_type, a.max_score,
                  s.name AS subject_name, t.name AS term_name
           FROM results r
           JOIN assessments a ON a.id = r.assessment_id
           LEFT JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN terms    t ON t.id = a.term_id
           WHERE r.school_id=$1 AND r.student_id=$2`;
  if (term_id) { params.push(term_id); q += ` AND a.term_id=$${params.length}`; }
  q += ' ORDER BY t.start_date DESC NULLS LAST, a.title';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /assessment/:id — all results for an assessment
router.get('/assessment/:assessment_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT r.*, st.name AS student_name, st.student_code
       FROM results r
       JOIN students st ON st.id = r.student_id
       WHERE r.school_id=$1 AND r.assessment_id=$2
       ORDER BY st.name`,
      [school_id, req.params.assessment_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE
router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM results WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
