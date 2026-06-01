const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', requirePrivilege('attendance:write'), async (req, res) => {
  const { class_id, date } = req.query;
  if (!class_id || !date) return res.status(400).json({ error: 'class_id and date required' });
  try {
    const result = await pool.query(
      `SELECT a.*, s.name, s.student_code
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.school_id = $1 AND a.class_id = $2 AND a.date = $3
       ORDER BY s.name`,
      [req.user.school_id, class_id, date]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk', requirePrivilege('attendance:write'), async (req, res) => {
  const { class_id, date, records } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!class_id || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: 'class_id, date and records required' });
  }
  const VALID_ATTENDANCE_STATUS = ['present', 'absent', 'late', 'excused'];
  for (const r of records) {
    if (!r.student_id) return res.status(400).json({ error: 'Each record requires student_id' });
    if (!VALID_ATTENDANCE_STATUS.includes(r.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_ATTENDANCE_STATUS.join(', ')}` });
    }
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      // recorded_at is the device timestamp when the record was created (supports offline sync).
      // If absent, default to now. The ON CONFLICT guard ensures a stale offline sync
      // never silently overwrites a newer online submission.
      const recordedAt = r.recorded_at ? new Date(r.recorded_at) : new Date();
      if (isNaN(recordedAt.getTime())) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid recorded_at for student_id ${r.student_id}` });
      }
      await client.query(
        `INSERT INTO attendance (school_id, student_id, class_id, date, status, recorded_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (school_id, student_id, date)
         DO UPDATE SET
           status      = EXCLUDED.status,
           recorded_by = EXCLUDED.recorded_by,
           updated_at  = EXCLUDED.updated_at
         WHERE attendance.updated_at < EXCLUDED.updated_at`,
        [school_id, r.student_id, class_id, date, r.status, recorded_by, recordedAt]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

router.get('/student/:student_id', requirePrivilege('attendance:write'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  try {
    let query, params;
    if (term_id) {
      query = `SELECT a.date, a.status, c.name AS class_name
               FROM attendance a
               JOIN classes c ON c.id = a.class_id
               JOIN terms t ON t.id = $3 AND t.school_id = $1
               WHERE a.school_id = $1 AND a.student_id = $2
                 AND a.date BETWEEN t.start_date AND t.end_date
               ORDER BY a.date DESC`;
      params = [school_id, req.params.student_id, term_id];
    } else {
      query = `SELECT a.date, a.status, c.name AS class_name
               FROM attendance a
               JOIN classes c ON c.id = a.class_id
               WHERE a.school_id = $1 AND a.student_id = $2
               ORDER BY a.date DESC`;
      params = [school_id, req.params.student_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
