const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/student/:student_id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT lp.* FROM learner_profiles lp
       JOIN students s ON s.id = lp.student_id
       WHERE lp.student_id = $1 AND s.school_id = $2`,
      [req.params.student_id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Create or update (upsert)
router.put('/student/:student_id', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { SEN_flag, gifted_flag, learning_style, accommodation } = req.body;
  try {
    const check = await pool.query(
      'SELECT id FROM students WHERE id=$1 AND school_id=$2',
      [req.params.student_id, school_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Student not found' });

    const result = await pool.query(
      `INSERT INTO learner_profiles (student_id, "SEN_flag", gifted_flag, learning_style, accommodation)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (student_id) DO UPDATE
         SET "SEN_flag"=$2, gifted_flag=$3, learning_style=$4, accommodation=$5
       RETURNING *`,
      [req.params.student_id, SEN_flag ?? false, gifted_flag ?? false,
       learning_style || null, accommodation || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
