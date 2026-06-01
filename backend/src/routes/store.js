const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

// ── Items ─────────────────────────────────────────────────────────────────
router.get('/items', requirePrivilege('store:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM store_items WHERE school_id=$1 ORDER BY name`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/items', requireRole('owner'), async (req, res) => {
  const { name, quantity = 0, unit, low_stock_threshold = 5 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const r = await pool.query(
      `INSERT INTO store_items (school_id, name, quantity, unit, low_stock_threshold)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, name, quantity, unit || null, low_stock_threshold]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Item already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/items/:id', requireRole('owner'), async (req, res) => {
  const { name, unit, low_stock_threshold } = req.body;
  try {
    const r = await pool.query(
      `UPDATE store_items SET name=$1, unit=$2, low_stock_threshold=$3
       WHERE id=$4 AND school_id=$5 RETURNING *`,
      [name, unit || null, low_stock_threshold ?? 5, req.params.id, req.user.school_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── Transactions ──────────────────────────────────────────────────────────
router.get('/transactions', requirePrivilege('store:manage'), async (req, res) => {
  const { item_id } = req.query;
  const params = [req.user.school_id];
  let q = `SELECT st.*, si.name AS item_name, u.name AS recorded_by_name
           FROM store_transactions st
           JOIN store_items si ON si.id = st.item_id
           JOIN users u ON u.id = st.recorded_by
           WHERE st.school_id = $1`;
  if (item_id) { params.push(item_id); q += ` AND st.item_id = $${params.length}`; }
  q += ' ORDER BY st.created_at DESC';
  try {
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/transactions', requireRole('owner'), async (req, res) => {
  const { item_id, quantity, type, notes } = req.body;
  if (!item_id || !quantity || !type) return res.status(400).json({ error: 'item_id, quantity, type required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemRes = await client.query(
      'SELECT id, quantity FROM store_items WHERE id=$1 AND school_id=$2 FOR UPDATE',
      [item_id, req.user.school_id]
    );
    if (!itemRes.rows.length) throw new Error('Item not found');

    const current = itemRes.rows[0].quantity;
    const delta   = type === 'restock' ? +quantity : -quantity;
    const updated = current + delta;
    if (updated < 0) throw new Error('Insufficient stock');

    await client.query(
      'UPDATE store_items SET quantity=$1 WHERE id=$2',
      [updated, item_id]
    );
    const tx = await client.query(
      `INSERT INTO store_transactions (school_id, item_id, recorded_by, quantity, type, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.school_id, item_id, req.user.id, quantity, type, notes || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...tx.rows[0], new_quantity: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── Low stock summary ─────────────────────────────────────────────────────
router.get('/low-stock', requirePrivilege('store:manage'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM store_items
       WHERE school_id=$1 AND quantity <= low_stock_threshold
       ORDER BY quantity ASC`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
