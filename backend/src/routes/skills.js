const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

// ─── Skill catalog ────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM skills WHERE school_id=$1 ORDER BY name',
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      'INSERT INTO skills (school_id, name) VALUES ($1,$2) RETURNING *',
      [req.user.school_id, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Skill already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      'UPDATE skills SET name=$1 WHERE id=$2 AND school_id=$3 RETURNING *',
      [name, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Skill already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM skills WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Student skills ────────────────────────────────────────────────────────────

router.get('/student/:student_id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT ss.*, sk.name AS skill_name
       FROM student_skills ss
       JOIN skills sk ON sk.id = ss.skill_id
       WHERE ss.school_id = $1 AND ss.student_id = $2
       ORDER BY sk.name`,
      [school_id, req.params.student_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Upsert a skill level for a student
router.put('/student/:student_id/:skill_id', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { level, evidence_source } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO student_skills (school_id, student_id, skill_id, level, evidence_source)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id, skill_id) DO UPDATE
         SET level=$4, evidence_source=$5
       RETURNING *`,
      [school_id, req.params.student_id, req.params.skill_id,
       level || null, evidence_source || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/student/:student_id/:skill_id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM student_skills WHERE student_id=$1 AND skill_id=$2 AND school_id=$3 RETURNING id',
      [req.params.student_id, req.params.skill_id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
