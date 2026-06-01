const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

const FAMILY_ROLES = ['owner', 'teacher', 'class_teacher', 'headmaster_admin', 'headmaster_academics', 'department_head'];

router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, COUNT(s.id)::int AS student_count
       FROM families f
       LEFT JOIN students s ON s.family_id = f.id AND s.status = 'active'
       WHERE f.school_id = $1
       GROUP BY f.id
       ORDER BY f.guardian_name NULLS LAST`,
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const fRes = await pool.query(
      'SELECT * FROM families WHERE id = $1 AND school_id = $2',
      [req.params.id, school_id]
    );
    if (!fRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const students = await pool.query(
      `SELECT s.id, s.name, s.student_code, s.status, c.name AS class_name
       FROM students s LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1 AND s.family_id = $2 ORDER BY s.name`,
      [school_id, req.params.id]
    );
    res.json({ ...fRes.rows[0], students: students.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { guardian_name, phone } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO families (school_id, guardian_name, phone) VALUES ($1,$2,$3) RETURNING *',
      [req.user.school_id, guardian_name || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { guardian_name, phone } = req.body;
  try {
    const result = await pool.query(
      'UPDATE families SET guardian_name=$1, phone=$2 WHERE id=$3 AND school_id=$4 RETURNING *',
      [guardian_name || null, phone || null, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const check = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM students WHERE family_id=$1 AND status='active'",
      [req.params.id]
    );
    if (check.rows[0].cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete family with active students' });
    }
    const result = await pool.query(
      'DELETE FROM families WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
