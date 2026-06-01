const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

router.get('/student/:student_id', async (req, res) => {
  const { school_id } = req.user;
  try {
    const pRes = await pool.query(
      'SELECT * FROM portfolios WHERE school_id=$1 AND student_id=$2',
      [school_id, req.params.student_id]
    );
    if (!pRes.rows.length) return res.status(404).json({ error: 'Portfolio not found' });
    const itemsRes = await pool.query(
      `SELECT pi.*, cb.name AS competency_name
       FROM portfolio_items pi
       LEFT JOIN competency_benchmarks cb ON cb.id = pi.competency_id
       WHERE pi.portfolio_id=$1 ORDER BY pi.created_at DESC`,
      [pRes.rows[0].id]
    );
    res.json({ ...pRes.rows[0], items: itemsRes.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, type } = req.body;
  if (!student_id) return res.status(400).json({ error: 'student_id required' });
  try {
    const result = await pool.query(
      'INSERT INTO portfolios (school_id, student_id, type) VALUES ($1,$2,$3) RETURNING *',
      [req.user.school_id, student_id, type || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:portfolio_id/items', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { competency_id, title, file_url } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const result = await pool.query(
      `INSERT INTO portfolio_items (school_id, portfolio_id, competency_id, title, file_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [school_id, req.params.portfolio_id, competency_id || null, title, file_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:portfolio_id/items/:item_id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM portfolio_items WHERE id=$1 AND portfolio_id=$2 AND school_id=$3 RETURNING id',
      [req.params.item_id, req.params.portfolio_id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', requirePrivilege('academic:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM portfolios WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
