const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

router.get('/', async (req, res) => {
  const { class_id, term_id } = req.query;
  if (!class_id) return res.status(400).json({ error: 'class_id required' });
  const params = [req.user.school_id, class_id];
  let q = `SELECT ts.*,
                  s.name  AS subject_name,  s.code AS subject_code,
                  u.name  AS teacher_name,
                  t.name  AS term_name
           FROM timetable_slots ts
           LEFT JOIN subjects s ON s.id = ts.subject_id
           LEFT JOIN users    u ON u.id = ts.teacher_id
           LEFT JOIN terms    t ON t.id = ts.term_id
           WHERE ts.school_id = $1 AND ts.class_id = $2`;
  if (term_id) { params.push(term_id); q += ` AND ts.term_id = $${params.length}`; }
  q += ' ORDER BY ts.day_of_week, ts.period_num';
  try {
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('timetable:manage'), async (req, res) => {
  const { class_id, subject_id, teacher_id, term_id, day_of_week, period_num, start_time, end_time, label } = req.body;
  if (class_id === undefined || day_of_week === undefined || period_num === undefined) {
    return res.status(400).json({ error: 'class_id, day_of_week, period_num required' });
  }
  try {
    const r = await pool.query(
      `INSERT INTO timetable_slots
         (school_id, class_id, subject_id, teacher_id, term_id, day_of_week, period_num, start_time, end_time, label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (school_id, class_id, term_id, day_of_week, period_num)
       DO UPDATE SET subject_id=$3, teacher_id=$4, start_time=$8, end_time=$9, label=$10
       RETURNING *`,
      [req.user.school_id, class_id, subject_id||null, teacher_id||null, term_id||null,
       day_of_week, period_num, start_time||null, end_time||null, label||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('timetable:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM timetable_slots WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
