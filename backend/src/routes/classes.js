const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();

// List classes ordered by promotion sequence.
// Teachers and class_teachers only see classes they are assigned to.
// Response includes the designated class teacher's name and id.
router.get('/', async (req, res) => {
  const { school_id, id: user_id, role } = req.user;
  try {
    const params = [school_id];
    let scopeClause = '';

    if (SCOPED_ROLES.has(role)) {
      const { rows } = await pool.query(
        `SELECT DISTINCT class_id FROM teaching_assignments WHERE school_id=$1 AND teacher_id=$2`,
        [school_id, user_id]
      );
      const classIds = rows.map(r => r.class_id);
      if (!classIds.length) return res.json([]);
      params.push(classIds);
      scopeClause = ` AND c.id = ANY($${params.length})`;
    }

    const result = await pool.query(
      `SELECT c.*,
              COUNT(s.id) AS student_count,
              u.id   AS class_teacher_id,
              u.name AS class_teacher_name
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
       LEFT JOIN users u ON u.id = c.class_teacher_id
       WHERE c.school_id = $1 AND c.deleted_at IS NULL${scopeClause}
       GROUP BY c.id, u.id, u.name
       ORDER BY c.order_num, c.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single class with its active students and class teacher info.
// Teachers can only access classes they are assigned to.
router.get('/:id', async (req, res) => {
  const { school_id, id: user_id, role } = req.user;
  try {
    const classRes = await pool.query(
      `SELECT c.*, u.id AS class_teacher_id, u.name AS class_teacher_name
       FROM classes c
       LEFT JOIN users u ON u.id = c.class_teacher_id
       WHERE c.id = $1 AND c.school_id = $2 AND c.deleted_at IS NULL`,
      [req.params.id, school_id]
    );
    if (!classRes.rows.length) return res.status(404).json({ error: 'Not found' });

    // Scoped roles may only access their assigned classes
    if (SCOPED_ROLES.has(role)) {
      const assignCheck = await pool.query(
        `SELECT 1 FROM teaching_assignments WHERE school_id=$1 AND teacher_id=$2 AND class_id=$3 LIMIT 1`,
        [school_id, user_id, req.params.id]
      );
      if (!assignCheck.rows.length) return res.status(403).json({ error: 'You are not assigned to this class' });
    }

    const studentsRes = await pool.query(
      `SELECT id, name, student_code, dob, gender, status
       FROM students WHERE class_id = $1 AND school_id = $2 AND status = 'active'
       ORDER BY name`,
      [req.params.id, school_id]
    );

    res.json({ ...classRes.rows[0], students: studentsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create class
router.post('/', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, order_num, is_special, class_fee } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      'INSERT INTO classes (school_id, name, order_num, is_special, class_fee) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.school_id, name, order_num ?? 0, !!is_special, parseFloat(class_fee) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update class — also allows setting/changing the designated class teacher.
// class_teacher_id must be a user in this school with role teacher or class_teacher.
router.put('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, order_num, is_special, class_fee, class_teacher_id } = req.body;
  const { school_id } = req.user;

  // Validate class_teacher_id if provided
  if (class_teacher_id) {
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id=$1 AND school_id=$2 AND role IN ('teacher','class_teacher') AND is_active=true`,
      [class_teacher_id, school_id]
    );
    if (!userCheck.rows.length) {
      return res.status(400).json({ error: 'class_teacher_id must be an active teacher or class_teacher in this school' });
    }
  }

  try {
    const result = await pool.query(
      `UPDATE classes
       SET name=$1, order_num=$2, is_special=$3, class_fee=$4,
           class_teacher_id=$5
       WHERE id=$6 AND school_id=$7 RETURNING *`,
      [name, order_num ?? 0, !!is_special, parseFloat(class_fee) || 0,
       class_teacher_id || null, req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate (soft-delete) class — blocks if active students assigned; creates deletion request
router.delete('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const activeCheck = await client.query(
      `SELECT id FROM students WHERE class_id = $1 AND school_id = $2 AND status = 'active' LIMIT 1`,
      [req.params.id, school_id]
    );
    if (activeCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cannot deactivate class with active students' });
    }

    const result = await client.query(
      `UPDATE classes SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND school_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [user_id, req.params.id, school_id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found or already deactivated' });
    }

    const cls = result.rows[0];
    const studentCount = (await client.query(
      `SELECT COUNT(*) FROM students WHERE class_id = $1`, [req.params.id]
    )).rows[0].count;

    await client.query(
      `INSERT INTO deletion_requests
         (school_id, entity_type, entity_id, entity_name, entity_snapshot, requested_by, reason)
       VALUES ($1,'class',$2,$3,$4,$5,$6)`,
      [school_id, req.params.id, cls.name, { ...cls, student_count: studentCount }, user_id, reason || null]
    );

    await client.query('COMMIT');
    res.json({ success: true, deactivated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
