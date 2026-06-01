const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/', async (req, res) => {
  const { academic_year } = req.query;
  const params = [req.user.school_id];
  let q = 'SELECT * FROM prospectus WHERE school_id=$1';
  if (academic_year) { params.push(academic_year); q += ` AND academic_year=$${params.length}`; }
  q += ' ORDER BY academic_year, item_name';
  try {
    const result = await pool.query(q, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('finance:write'), async (req, res) => {
  const { academic_year, item_name, amount } = req.body;
  if (!academic_year || !item_name || amount == null) {
    return res.status(400).json({ error: 'academic_year, item_name and amount required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO prospectus (school_id, academic_year, item_name, amount)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.school_id, academic_year, item_name, amount]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { academic_year, item_name, amount } = req.body;
  if (!academic_year || !item_name || amount == null) {
    return res.status(400).json({ error: 'academic_year, item_name and amount required' });
  }
  try {
    const result = await pool.query(
      `UPDATE prospectus SET academic_year=$1, item_name=$2, amount=$3
       WHERE id=$4 AND school_id=$5 RETURNING *`,
      [academic_year, item_name, amount, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('finance:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM prospectus WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
