const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

const RECORD_ROLES = ['owner','teacher','class_teacher','headmaster_academics'];

router.post('/records', requirePrivilege('feeding:write'), async (req, res) => {
  const { student_id, class_id, date, amount, meal_type = 'lunch' } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id || !class_id || !date) {
    return res.status(400).json({ error: 'student_id, class_id, date required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO feeding_records (school_id, student_id, class_id, date, amount, meal_type, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (school_id, student_id, date)
       DO UPDATE SET amount = EXCLUDED.amount, meal_type = EXCLUDED.meal_type,
                     recorded_by = EXCLUDED.recorded_by
       RETURNING *`,
      [school_id, student_id, class_id, date, amount || 0, meal_type, recorded_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/records/bulk', requirePrivilege('feeding:write'), async (req, res) => {
  const { class_id, date, amount, meal_type = 'lunch', student_ids } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!class_id || !date) {
    return res.status(400).json({ error: 'class_id and date required' });
  }
  const client = await pool.connect();
  try {
    let students;
    if (Array.isArray(student_ids) && student_ids.length) {
      const r = await client.query(
        `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND status='active' AND id=ANY($3)`,
        [school_id, class_id, student_ids]
      );
      students = r.rows.map(r => r.id);
    } else {
      const r = await client.query(
        `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND status='active'`,
        [school_id, class_id]
      );
      students = r.rows.map(r => r.id);
    }
    if (!students.length) return res.status(400).json({ error: 'No active students found' });

    await client.query('BEGIN');
    for (const student_id of students) {
      await client.query(
        `INSERT INTO feeding_records (school_id, student_id, class_id, date, amount, meal_type, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (school_id, student_id, date)
         DO UPDATE SET amount = EXCLUDED.amount, meal_type = EXCLUDED.meal_type,
                       recorded_by = EXCLUDED.recorded_by`,
        [school_id, student_id, class_id, date, amount || 0, meal_type, recorded_by]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: students.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.get('/records', requirePrivilege('feeding:write'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id, date_from, date_to, student_id } = req.query;
  const params = [school_id];
  let q = `SELECT fr.*, s.name AS student_name, c.name AS class_name
           FROM feeding_records fr
           JOIN students s ON s.id = fr.student_id
           JOIN classes c ON c.id = fr.class_id
           WHERE fr.school_id = $1`;
  if (class_id)   { params.push(class_id);   q += ` AND fr.class_id   = $${params.length}`; }
  if (date_from)  { params.push(date_from);  q += ` AND fr.date      >= $${params.length}`; }
  if (date_to)    { params.push(date_to);    q += ` AND fr.date      <= $${params.length}`; }
  if (student_id) { params.push(student_id); q += ` AND fr.student_id = $${params.length}`; }
  q += ' ORDER BY fr.date DESC, s.name';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/summary/student/:id', requirePrivilege('feeding:write'), async (req, res) => {
  const { school_id } = req.user;
  const { date_from, date_to } = req.query;
  const params = [school_id, req.params.id];
  let q = `SELECT COUNT(*)::int AS days_fed, COALESCE(SUM(amount),0) AS total_amount
           FROM feeding_records WHERE school_id=$1 AND student_id=$2`;
  if (date_from) { params.push(date_from); q += ` AND date >= $${params.length}`; }
  if (date_to)   { params.push(date_to);   q += ` AND date <= $${params.length}`; }
  try {
    const result = await pool.query(q, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/summary/class/:id', requirePrivilege('feeding:write'), async (req, res) => {
  const { school_id } = req.user;
  const { date_from, date_to } = req.query;
  const params = [school_id, req.params.id];
  const recFilter = ['fr.school_id = $1'];
  if (date_from) { params.push(date_from); recFilter.push(`fr.date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   recFilter.push(`fr.date <= $${params.length}`); }
  const q = `
    SELECT s.id AS student_id, s.name AS student_name, s.student_code,
           COUNT(fr.id)::int AS days_fed,
           COALESCE(SUM(fr.amount), 0) AS total_amount
    FROM students s
    LEFT JOIN feeding_records fr ON fr.student_id = s.id AND ${recFilter.join(' AND ')}
    WHERE s.school_id = $1 AND s.class_id = $2 AND s.status = 'active'
    GROUP BY s.id, s.name, s.student_code ORDER BY s.name`;
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/records/:id', requirePrivilege('feeding:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM feeding_records WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
