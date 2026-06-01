const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  const { subject_id } = req.query;
  const params = [req.user.school_id];
  let q = `SELECT p.*, s.name AS subject_name
           FROM projects p
           LEFT JOIN subjects s ON s.id = p.subject_id
           WHERE p.school_id = $1`;
  if (subject_id) { params.push(subject_id); q += ` AND p.subject_id = $${params.length}`; }
  q += ' ORDER BY p.created_at DESC';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const [pRes, mRes, sRes] = await Promise.all([
      pool.query(
        `SELECT p.*, s.name AS subject_name FROM projects p
         LEFT JOIN subjects s ON s.id = p.subject_id
         WHERE p.id=$1 AND p.school_id=$2`,
        [req.params.id, school_id]
      ),
      pool.query(
        `SELECT pm.id, pm.student_id, st.name AS student_name
         FROM project_members pm
         JOIN students st ON st.id = pm.student_id
         WHERE pm.project_id=$1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT ps.*, st.name AS student_name, r.title AS rubric_title
         FROM project_scores ps
         JOIN students st ON st.id = ps.student_id
         LEFT JOIN rubrics r ON r.id = ps.rubric_id
         WHERE ps.project_id=$1 AND ps.school_id=$2`,
        [req.params.id, school_id]
      )
    ]);
    if (!pRes.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...pRes.rows[0], members: mRes.rows, scores: sRes.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { title, subject_id, description, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `INSERT INTO projects (school_id, subject_id, title, description, type)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, subject_id || null, title, description || null, type || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { title, subject_id, description, type } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `UPDATE projects SET title=$1, subject_id=$2, description=$3, type=$4
       WHERE id=$5 AND school_id=$6 RETURNING *`,
      [title, subject_id || null, description || null, type || null,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/members', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO project_members (school_id, project_id, student_id)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *`,
      [school_id, req.params.id, student_id]
    );
    res.status(201).json(result.rows[0] || { message: 'Already a member' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id/members/:student_id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM project_members WHERE project_id=$1 AND student_id=$2 AND school_id=$3',
      [req.params.id, req.params.student_id, req.user.school_id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/scores', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, rubric_id, rubric_score, feedback } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO project_scores
         (school_id, project_id, student_id, rubric_id, rubric_score, feedback, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (project_id, student_id) DO UPDATE
         SET rubric_id=$4, rubric_score=$5, feedback=$6, recorded_by=$7
       RETURNING *`,
      [school_id, req.params.id, student_id, rubric_id || null,
       rubric_score || null, feedback || null, recorded_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
