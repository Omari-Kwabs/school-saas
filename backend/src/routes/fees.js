const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');

const router = express.Router();

// Fee Types
router.get('/types', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  try {
    let query, params;
    if (term_id) {
      query = 'SELECT * FROM fee_types WHERE school_id = $1 AND term_id = $2 ORDER BY name';
      params = [school_id, term_id];
    } else {
      query = 'SELECT * FROM fee_types WHERE school_id = $1 ORDER BY name';
      params = [school_id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/types', requirePrivilege('finance:write'), async (req, res) => {
  const { name, amount, term_id, applies_to_class } = req.body;
  if (!name || amount == null) return res.status(400).json({ error: 'name and amount required' });
  try {
    const result = await pool.query(
      `INSERT INTO fee_types (school_id, name, amount, term_id, applies_to_class)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, name, amount, term_id || null, applies_to_class || null]
    );
    audit(req, 'CREATE', 'fee_type', result.rows[0].id, { name, amount });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/types/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { name, amount, term_id, applies_to_class } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fee_types SET name=$1, amount=$2, term_id=$3, applies_to_class=$4
       WHERE id=$5 AND school_id=$6 RETURNING *`,
      [name, amount, term_id || null, applies_to_class || null, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/types/:id', requirePrivilege('finance:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM fee_types WHERE id = $1 AND school_id = $2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Payments
router.get('/payments', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, fee_type_id } = req.query;
  try {
    let conditions = ['p.school_id = $1'];
    let params = [school_id];
    if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
    if (fee_type_id) { params.push(fee_type_id); conditions.push(`p.fee_type_id = $${params.length}`); }
    const result = await pool.query(
      `SELECT p.*, s.name AS student_name, ft.name AS fee_name
       FROM fee_payments p
       JOIN students s ON s.id = p.student_id
       JOIN fee_types ft ON ft.id = p.fee_type_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.payment_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/payments', requirePrivilege('finance:write'), async (req, res) => {
  const { student_id, fee_type_id, amount_paid, payment_date, receipt_number, notes } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id || !fee_type_id || amount_paid == null) {
    return res.status(400).json({ error: 'student_id, fee_type_id, and amount_paid required' });
  }
  if (isNaN(parseFloat(amount_paid)) || parseFloat(amount_paid) <= 0) {
    return res.status(400).json({ error: 'amount_paid must be a positive number' });
  }
  try {
    const studentCheck = await pool.query(
      'SELECT id FROM students WHERE id=$1 AND school_id=$2',
      [student_id, school_id]
    );
    if (!studentCheck.rows.length) return res.status(404).json({ error: 'Student not found' });

    const result = await pool.query(
      `INSERT INTO fee_payments (school_id, student_id, fee_type_id, amount_paid,
         payment_date, receipt_number, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [school_id, student_id, fee_type_id, amount_paid,
       payment_date, receipt_number, notes, recorded_by]
    );
    audit(req, 'CREATE', 'fee_payment', result.rows[0].id, { student_id, fee_type_id, amount_paid });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/balance/:student_id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id } = req.params;
  const { computeDiscount } = require('./discounts');
  try {
    const studentRes = await pool.query(
      'SELECT id, family_id FROM students WHERE id = $1 AND school_id = $2',
      [student_id, school_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const { family_id } = studentRes.rows[0];

    const { discounts: applicable } = await computeDiscount(school_id, student_id, family_id);

    const result = await pool.query(
      `SELECT ft.id, ft.name, ft.amount AS expected,
              COALESCE(SUM(p.amount_paid), 0) AS paid
       FROM fee_types ft
       LEFT JOIN fee_payments p ON p.fee_type_id = ft.id AND p.student_id = $2
       WHERE ft.school_id = $1
       GROUP BY ft.id, ft.name, ft.amount
       ORDER BY ft.name`,
      [school_id, student_id]
    );

    const rows = result.rows.map(row => {
      let discounted = parseFloat(row.expected);
      for (const d of applicable) {
        if (d.type === 'percent') {
          discounted = discounted * (1 - parseFloat(d.value) / 100);
        } else {
          discounted = Math.max(0, discounted - parseFloat(d.value));
        }
      }
      discounted = Math.round(discounted * 100) / 100;
      const paid = parseFloat(row.paid);
      return {
        ...row,
        discounted_expected: discounted,
        balance: Math.round((discounted - paid) * 100) / 100,
        discounts_applied: applicable.map(d => ({ id: d.id, name: d.name, type: d.type, value: d.value }))
      };
    });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
