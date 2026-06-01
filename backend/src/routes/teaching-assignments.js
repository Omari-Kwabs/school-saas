const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { teacher_id, class_id } = req.query;
  const params = [req.user.school_id];
  let q = `SELECT ta.*,
                  u.name  AS teacher_name,  u.role AS teacher_role,
                  c.name  AS class_name,
                  s.name  AS subject_name,  s.code AS subject_code,
                  t.name  AS term_name
           FROM teaching_assignments ta
           JOIN users    u ON u.id = ta.teacher_id
           JOIN classes  c ON c.id = ta.class_id
           JOIN subjects s ON s.id = ta.subject_id
           LEFT JOIN terms t ON t.id = ta.term_id
           WHERE ta.school_id = $1`;

  // Scoped roles only see their own assignments; admins can filter by any teacher_id
  if (SCOPED_ROLES.has(req.user.role)) {
    params.push(req.user.id);
    q += ` AND ta.teacher_id = $${params.length}`;
  } else {
    if (teacher_id) { params.push(teacher_id); q += ` AND ta.teacher_id = $${params.length}`; }
  }
  if (class_id) { params.push(class_id); q += ` AND ta.class_id = $${params.length}`; }
  q += ' ORDER BY u.name, c.name, s.name';
  try {
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('timetable:manage'), async (req, res) => {
  const { teacher_id, class_id, subject_id, term_id } = req.body;
  if (!teacher_id || !class_id || !subject_id) {
    return res.status(400).json({ error: 'teacher_id, class_id, subject_id required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO teaching_assignments (school_id, teacher_id, class_id, subject_id, term_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, teacher_id, class_id, subject_id, term_id || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Assignment already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requirePrivilege('timetable:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM teaching_assignments WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
