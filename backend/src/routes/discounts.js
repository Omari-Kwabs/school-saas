const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM discounts WHERE school_id = $1 ORDER BY applies_from_sibling, name',
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requirePrivilege('finance:write'), async (req, res) => {
  const { name, type, value, applies_from_sibling } = req.body;
  if (!name || !type || value == null) {
    return res.status(400).json({ error: 'name, type and value required' });
  }
  if (!['percent', 'flat'].includes(type)) {
    return res.status(400).json({ error: "type must be 'percent' or 'flat'" });
  }
  if (isNaN(parseFloat(value)) || parseFloat(value) < 0) {
    return res.status(400).json({ error: 'value must be a non-negative number' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO discounts (school_id, name, type, value, applies_from_sibling)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, name, type, value, applies_from_sibling ?? 3]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { name, type, value, applies_from_sibling, is_active } = req.body;
  if (type !== undefined && !['percent', 'flat'].includes(type)) {
    return res.status(400).json({ error: "type must be 'percent' or 'flat'" });
  }
  if (value !== undefined && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
    return res.status(400).json({ error: 'value must be a non-negative number' });
  }
  try {
    const result = await pool.query(
      `UPDATE discounts
       SET name=$1, type=$2, value=$3, applies_from_sibling=$4, is_active=$5
       WHERE id=$6 AND school_id=$7 RETURNING *`,
      [name, type, value, applies_from_sibling ?? 3, is_active ?? true,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requirePrivilege('finance:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM discounts WHERE id = $1 AND school_id = $2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Compute applicable discounts for a single student
router.get('/student/:student_id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const studentRes = await pool.query(
      'SELECT id, name, family_id FROM students WHERE id = $1 AND school_id = $2',
      [req.params.student_id, school_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];

    if (!student.family_id) {
      return res.json({
        student_id: student.id, student_name: student.name,
        sibling_rank: 1, family_size: 1, discounts: []
      });
    }

    const { rank, family_size, discounts } = await computeDiscount(school_id, student.id, student.family_id);
    res.json({ student_id: student.id, student_name: student.name, sibling_rank: rank, family_size, discounts });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Family overview — all siblings with their discount eligibility
router.get('/family/:family_id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const siblingsRes = await pool.query(
      `SELECT s.id, s.name, s.status, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1 AND s.family_id = $2
       ORDER BY s.id ASC`,
      [school_id, req.params.family_id]
    );

    const discountRulesRes = await pool.query(
      'SELECT * FROM discounts WHERE school_id = $1 AND is_active = true ORDER BY applies_from_sibling ASC',
      [school_id]
    );
    const rules = discountRulesRes.rows;

    const activeCount = siblingsRes.rows.filter(s => s.status === 'active').length;
    let activeRank = 0;

    const siblings = siblingsRes.rows.map(s => {
      if (s.status === 'active') activeRank++;
      const rank = s.status === 'active' ? activeRank : null;
      const discounts = rank != null
        ? rules.filter(d => activeCount >= d.applies_from_sibling && rank >= d.applies_from_sibling)
        : [];
      return { ...s, sibling_rank: rank, discounts };
    });

    res.json({ family_id: req.params.family_id, family_size: activeCount, siblings });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Shared helper used by fees balance endpoint
async function computeDiscount(school_id, student_id, family_id) {
  if (!family_id) return { rank: 1, family_size: 1, discounts: [] };

  const siblingsRes = await pool.query(
    `SELECT id FROM students
     WHERE school_id = $1 AND family_id = $2 AND status = 'active'
     ORDER BY id ASC`,
    [school_id, family_id]
  );
  const siblings = siblingsRes.rows;
  const family_size = siblings.length;
  const rank = siblings.findIndex(s => s.id === student_id) + 1;

  if (rank === 0) return { rank: null, family_size, discounts: [] };

  const discountsRes = await pool.query(
    `SELECT * FROM discounts
     WHERE school_id = $1 AND is_active = true
       AND applies_from_sibling <= $2
     ORDER BY value DESC`,
    [school_id, rank]
  );
  const discounts = discountsRes.rows.filter(d => family_size >= d.applies_from_sibling);
  return { rank, family_size, discounts };
}

module.exports = router;
module.exports.computeDiscount = computeDiscount;
