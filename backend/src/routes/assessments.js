const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { getTeacherScope } = require('../lib/teacherScope');

const router = express.Router();

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id, term_id, subject_id, type } = req.query;
  const params = [school_id];
  let q = `SELECT a.*, s.name AS subject_name, c.name AS class_name, t.name AS term_name
           FROM assessments a
           LEFT JOIN subjects s ON s.id = a.subject_id
           LEFT JOIN classes  c ON c.id = a.class_id
           LEFT JOIN terms    t ON t.id = a.term_id
           WHERE a.school_id = $1`;
  if (class_id)   { params.push(class_id);   q += ` AND a.class_id   = $${params.length}`; }
  if (term_id)    { params.push(term_id);     q += ` AND a.term_id    = $${params.length}`; }
  if (subject_id) { params.push(subject_id);  q += ` AND a.subject_id = $${params.length}`; }
  if (type)       { params.push(type);        q += ` AND a.type       = $${params.length}`; }

  // Scoped teachers only see assessments for their assigned classes
  const scope = await getTeacherScope(req.user, term_id || null);
  if (scope) {
    if (!scope.classIds.length) return res.json([]);
    params.push(scope.classIds);
    q += ` AND a.class_id = ANY($${params.length})`;
  }

  q += ' ORDER BY a.created_at DESC';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const [aRes, cRes] = await Promise.all([
      pool.query(
        `SELECT a.*, s.name AS subject_name, c.name AS class_name, t.name AS term_name
         FROM assessments a
         LEFT JOIN subjects s ON s.id = a.subject_id
         LEFT JOIN classes  c ON c.id = a.class_id
         LEFT JOIN terms    t ON t.id = a.term_id
         WHERE a.id=$1 AND a.school_id=$2`,
        [req.params.id, school_id]
      ),
      pool.query(
        `SELECT acm.id, acm.competency_id, cb.name AS competency_name
         FROM assessment_competency_map acm
         JOIN competency_benchmarks cb ON cb.id = acm.competency_id
         WHERE acm.assessment_id = $1`,
        [req.params.id]
      )
    ]);
    if (!aRes.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...aRes.rows[0], competencies: cRes.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { subject_id, class_id, term_id, title, type, format, term,
          academic_year, max_score, competency_ids } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'title and type required' });

  if (class_id && subject_id) {
    const scope = await getTeacherScope(req.user);
    if (scope && !scope.isTeacherOf(class_id, subject_id)) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const aRes = await client.query(
      `INSERT INTO assessments
         (school_id, subject_id, class_id, term_id, title, type, format, term, academic_year, max_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.school_id, subject_id || null, class_id || null, term_id || null,
       title, type, format || null, term || null, academic_year || null, max_score || null]
    );
    const assessment = aRes.rows[0];
    if (Array.isArray(competency_ids)) {
      for (const cid of competency_ids) {
        await client.query(
          `INSERT INTO assessment_competency_map (assessment_id, competency_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [assessment.id, cid]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(assessment);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { subject_id, class_id, term_id, title, type, format, term, academic_year, max_score } = req.body;
  if (!title || !type) return res.status(400).json({ error: 'title and type required' });

  const scope = await getTeacherScope(req.user);
  if (scope) {
    const existing = await pool.query(
      'SELECT class_id, subject_id FROM assessments WHERE id=$1 AND school_id=$2',
      [req.params.id, req.user.school_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const { class_id: eClass, subject_id: eSubject } = existing.rows[0];
    if (!scope.isTeacherOf(eClass, eSubject)) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE assessments
         SET subject_id=$1, class_id=$2, term_id=$3, title=$4, type=$5,
             format=$6, term=$7, academic_year=$8, max_score=$9
       WHERE id=$10 AND school_id=$11 RETURNING *`,
      [subject_id || null, class_id || null, term_id || null, title, type,
       format || null, term || null, academic_year || null, max_score || null,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Sync competency mappings for an assessment (replaces existing)
router.put('/:id/competencies', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { competency_ids } = req.body;
  if (!Array.isArray(competency_ids)) {
    return res.status(400).json({ error: 'competency_ids array required' });
  }
  const check = await pool.query(
    'SELECT id FROM assessments WHERE id=$1 AND school_id=$2',
    [req.params.id, school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: 'Assessment not found' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM assessment_competency_map WHERE assessment_id=$1', [req.params.id]);
    for (const cid of competency_ids) {
      await client.query(
        `INSERT INTO assessment_competency_map (assessment_id, competency_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [req.params.id, cid]
      );
    }
    await client.query('COMMIT');
    const result = await pool.query(
      `SELECT acm.id, acm.competency_id, cb.name
       FROM assessment_competency_map acm
       JOIN competency_benchmarks cb ON cb.id = acm.competency_id
       WHERE acm.assessment_id=$1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const scope = await getTeacherScope(req.user);
  if (scope) {
    const existing = await pool.query(
      'SELECT class_id, subject_id FROM assessments WHERE id=$1 AND school_id=$2',
      [req.params.id, req.user.school_id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Not found' });
    const { class_id, subject_id } = existing.rows[0];
    if (!scope.isTeacherOf(class_id, subject_id)) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
    }
  }
  try {
    const result = await pool.query(
      'DELETE FROM assessments WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
