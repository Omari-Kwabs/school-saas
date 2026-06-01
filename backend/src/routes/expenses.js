const express = require('express');
const pool = require('../config/db');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');

const router = express.Router();

const READ  = requirePrivilege('finance:read');
const WRITE = requirePrivilege('finance:write');

// GET /api/expenses — list with filters
router.get('/', READ, async (req, res) => {
  const { school_id } = req.user;
  const { category, date_from, date_to, search, limit = 100, offset = 0 } = req.query;

  const params = [school_id];
  const conds  = ['e.school_id = $1', 'e.deleted_at IS NULL'];

  if (category) { params.push(category); conds.push(`e.category = $${params.length}`); }
  if (date_from) { params.push(date_from); conds.push(`e.expense_date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conds.push(`e.expense_date <= $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conds.push(`(e.receipt_number ILIKE $${params.length} OR e.description ILIKE $${params.length} OR e.paid_to ILIKE $${params.length})`);
  }

  const where = conds.join(' AND ');
  params.push(Number(limit), Number(offset));

  const { rows } = await pool.query(
    `SELECT e.*,
            u.name AS created_by_name
     FROM expenses e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE ${where}
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM expenses e WHERE ${where}`,
    params.slice(0, params.length - 2),
  );

  res.json({ expenses: rows, total: Number(countRes.rows[0].count) });
});

// GET /api/expenses/categories — distinct categories used by this school
router.get('/categories', READ, async (req, res) => {
  const { school_id } = req.user;
  const { rows } = await pool.query(
    `SELECT DISTINCT category FROM expenses WHERE school_id = $1 ORDER BY category`,
    [school_id],
  );
  res.json(rows.map(r => r.category));
});

// GET /api/expenses/analytics — totals by category + monthly breakdown
router.get('/analytics', READ, async (req, res) => {
  const { school_id } = req.user;
  const { date_from, date_to } = req.query;

  const params = [school_id];
  const conds  = ['school_id = $1'];
  if (date_from) { params.push(date_from); conds.push(`expense_date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conds.push(`expense_date <= $${params.length}`); }
  const where = conds.join(' AND ');

  const [byCategory, byMonth, summary] = await Promise.all([
    pool.query(
      `SELECT category,
              COUNT(*)          AS count,
              SUM(amount)       AS total
       FROM expenses WHERE ${where}
       GROUP BY category
       ORDER BY total DESC`,
      params,
    ),
    pool.query(
      `SELECT TO_CHAR(expense_date, 'YYYY-MM') AS month,
              SUM(amount)                       AS total,
              COUNT(*)                          AS count
       FROM expenses WHERE ${where}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params,
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)  AS grand_total,
              COUNT(*)                   AS total_count
       FROM expenses WHERE ${where}`,
      params,
    ),
  ]);

  res.json({
    by_category: byCategory.rows,
    by_month:    byMonth.rows,
    grand_total: Number(summary.rows[0].grand_total),
    total_count: Number(summary.rows[0].total_count),
  });
});

// GET /api/expenses/summary — cash book: opening balance + income + expenditure + closing balance
router.get('/summary', READ, async (req, res) => {
  const { school_id } = req.user;
  const { date_from, date_to, period_key } = req.query;

  if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to are required' });

  const pKey = period_key || date_from.slice(0, 7); // default to YYYY-MM of date_from

  const [balRow, incomeRow, expRows, incomeByMethod] = await Promise.all([
    // Opening balance for this period
    pool.query(
      `SELECT opening_balance, notes FROM financial_period_balances
       WHERE school_id = $1 AND period_key = $2`,
      [school_id, pKey],
    ),
    // Total income (payments) in period
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total,
              COUNT(*)                  AS count
       FROM payments
       WHERE school_id = $1
         AND payment_date >= $2 AND payment_date <= $3`,
      [school_id, date_from, date_to],
    ),
    // Expenditure by category
    pool.query(
      `SELECT category,
              COALESCE(SUM(amount), 0) AS total,
              COUNT(*)                  AS count
       FROM expenses
       WHERE school_id = $1
         AND expense_date >= $2 AND expense_date <= $3
       GROUP BY category
       ORDER BY total DESC`,
      [school_id, date_from, date_to],
    ),
    // Income breakdown by payment method
    pool.query(
      `SELECT COALESCE(method, 'Unspecified') AS method,
              COALESCE(SUM(amount), 0)         AS total,
              COUNT(*)                          AS count
       FROM payments
       WHERE school_id = $1
         AND payment_date >= $2 AND payment_date <= $3
       GROUP BY method
       ORDER BY total DESC`,
      [school_id, date_from, date_to],
    ),
  ]);

  const opening_balance  = Number(balRow.rows[0]?.opening_balance ?? 0);
  const total_income     = Number(incomeRow.rows[0].total);
  const total_expenditure = expRows.rows.reduce((s, r) => s + Number(r.total), 0);
  const closing_balance  = opening_balance + total_income - total_expenditure;

  res.json({
    period_key:       pKey,
    date_from,
    date_to,
    opening_balance,
    opening_notes:    balRow.rows[0]?.notes || null,
    income: {
      total:      total_income,
      count:      Number(incomeRow.rows[0].count),
      by_method:  incomeByMethod.rows.map(r => ({ ...r, total: Number(r.total), count: Number(r.count) })),
    },
    expenditure: {
      total:       total_expenditure,
      by_category: expRows.rows.map(r => ({ ...r, total: Number(r.total), count: Number(r.count) })),
    },
    closing_balance,
    surplus: closing_balance >= 0,
  });
});

// PUT /api/expenses/opening-balance/:period_key — save opening balance for a period
router.put('/opening-balance/:period_key', WRITE, async (req, res) => {
  const { school_id, id: updated_by } = req.user;
  const { period_key } = req.params;
  const { opening_balance, notes } = req.body;

  if (opening_balance === undefined || opening_balance === null)
    return res.status(400).json({ error: 'opening_balance is required' });

  const { rows } = await pool.query(
    `INSERT INTO financial_period_balances (school_id, period_key, opening_balance, notes, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (school_id, period_key)
     DO UPDATE SET opening_balance = EXCLUDED.opening_balance,
                   notes           = EXCLUDED.notes,
                   updated_by      = EXCLUDED.updated_by,
                   updated_at      = NOW()
     RETURNING *`,
    [school_id, period_key, Number(opening_balance), notes?.trim() || null, updated_by],
  );
  res.json(rows[0]);
});

// POST /api/expenses — create
router.post('/', WRITE, async (req, res) => {
  const { school_id, id: created_by } = req.user;
  const { receipt_number, category, description, amount, expense_date, paid_to, notes } = req.body;

  if (!receipt_number?.trim()) return res.status(400).json({ error: 'Receipt number is required' });
  if (!category?.trim())       return res.status(400).json({ error: 'Category is required' });
  if (!description?.trim())    return res.status(400).json({ error: 'Description is required' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
  if (!expense_date)           return res.status(400).json({ error: 'Expense date is required' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO expenses
         (school_id, receipt_number, category, description, amount, expense_date, paid_to, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [school_id, receipt_number.trim(), category.trim(), description.trim(),
       Number(amount), expense_date, paid_to?.trim() || null, notes?.trim() || null, created_by],
    );
    audit(req, 'CREATE', 'expense', rows[0].id, { receipt_number: rows[0].receipt_number, amount: rows[0].amount });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Receipt number "${receipt_number}" already exists` });
    throw err;
  }
});

// PUT /api/expenses/:id — update
router.put('/:id', WRITE, async (req, res) => {
  const { school_id } = req.user;
  const { id } = req.params;
  const { receipt_number, category, description, amount, expense_date, paid_to, notes } = req.body;

  if (!receipt_number?.trim()) return res.status(400).json({ error: 'Receipt number is required' });
  if (!category?.trim())       return res.status(400).json({ error: 'Category is required' });
  if (!description?.trim())    return res.status(400).json({ error: 'Description is required' });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });
  if (!expense_date)           return res.status(400).json({ error: 'Expense date is required' });

  try {
    const { rows } = await pool.query(
      `UPDATE expenses SET
         receipt_number = $1, category = $2, description = $3,
         amount = $4, expense_date = $5, paid_to = $6, notes = $7,
         updated_at = NOW()
       WHERE id = $8 AND school_id = $9
       RETURNING *`,
      [receipt_number.trim(), category.trim(), description.trim(),
       Number(amount), expense_date, paid_to?.trim() || null, notes?.trim() || null,
       id, school_id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
    audit(req, 'UPDATE', 'expense', id, { receipt_number: rows[0].receipt_number });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: `Receipt number "${receipt_number}" already exists` });
    throw err;
  }
});

// DELETE /api/expenses/:id — soft-delete + create deletion request
router.delete('/:id', WRITE, async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE expenses SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND school_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [user_id, req.params.id, school_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found or already deactivated' });
    }

    const e = rows[0];
    await client.query(
      `INSERT INTO deletion_requests
         (school_id, entity_type, entity_id, entity_name, entity_snapshot, requested_by, reason)
       VALUES ($1,'expense',$2,$3,$4,$5,$6)`,
      [school_id, e.id, `Receipt #${e.receipt_number} — ${e.description}`, e, user_id, reason || null]
    );

    await client.query('COMMIT');
    audit(req, 'DEACTIVATE', 'expense', e.id, { receipt_number: e.receipt_number });
    res.json({ ok: true, deactivated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
