const express = require('express');
const pool = require('../config/db');
const { notify } = require('../lib/notify');

const router = express.Router();

// Staff list for recipient/CC picker (all active staff except self)
router.get('/staff', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, name, role FROM users
       WHERE school_id = $1 AND is_active = true AND id != $2
       ORDER BY name`,
      [req.user.school_id, req.user.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Inbox: memos where I am the primary recipient OR CC'd
router.get('/inbox', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.id, m.subject, m.body, m.created_at,
              f.id AS from_id, f.name AS from_name, f.role AS from_role,
              t.name AS to_name,
              m.read_at,
              false AS is_cc,
              (SELECT json_agg(json_build_object('id', cu.id, 'name', cu.name))
               FROM memo_cc cc JOIN users cu ON cu.id = cc.user_id
               WHERE cc.memo_id = m.id) AS cc_list
       FROM memos m
       JOIN users f ON f.id = m.from_id
       JOIN users t ON t.id = m.to_id
       WHERE m.school_id = $1 AND m.to_id = $2

       UNION ALL

       SELECT m.id, m.subject, m.body, m.created_at,
              f.id AS from_id, f.name AS from_name, f.role AS from_role,
              t.name AS to_name,
              mc.read_at,
              true AS is_cc,
              (SELECT json_agg(json_build_object('id', cu.id, 'name', cu.name))
               FROM memo_cc cc JOIN users cu ON cu.id = cc.user_id
               WHERE cc.memo_id = m.id) AS cc_list
       FROM memos m
       JOIN users f ON f.id = m.from_id
       JOIN users t ON t.id = m.to_id
       JOIN memo_cc mc ON mc.memo_id = m.id AND mc.user_id = $2
       WHERE m.school_id = $1

       ORDER BY created_at DESC`,
      [req.user.school_id, req.user.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Sent: memos I composed
router.get('/sent', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.id, m.subject, m.body, m.created_at, m.read_at,
              t.name AS to_name,
              (SELECT json_agg(json_build_object('id', cu.id, 'name', cu.name, 'read_at', mc.read_at))
               FROM memo_cc mc JOIN users cu ON cu.id = mc.user_id
               WHERE mc.memo_id = m.id) AS cc_list
       FROM memos m
       JOIN users t ON t.id = m.to_id
       WHERE m.school_id = $1 AND m.from_id = $2
       ORDER BY m.created_at DESC`,
      [req.user.school_id, req.user.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Compose / send a memo
router.post('/', async (req, res) => {
  const { to_id, subject, body, cc_ids = [] } = req.body;
  if (!to_id || !subject) return res.status(400).json({ error: 'to_id and subject required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(
      `INSERT INTO memos (school_id, from_id, to_id, subject, body)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.school_id, req.user.id, to_id, subject, body || null]
    );
    const memo = r.rows[0];

    const validCC = [...new Set(cc_ids)].filter(id => id !== to_id && id !== req.user.id);
    if (validCC.length > 0) {
      const placeholders = validCC.map((_, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO memo_cc (memo_id, user_id) VALUES ${placeholders}`,
        [memo.id, ...validCC]
      );
    }

    await client.query('COMMIT');
    notify(req.user.school_id, 'memo', { id: memo.id, subject, from: req.user.name, to_id });
    res.status(201).json(memo);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

// Mark memo as read (handles both primary recipient and CC)
router.put('/:id/read', async (req, res) => {
  try {
    const check = await pool.query(
      'SELECT id, to_id FROM memos WHERE id=$1 AND school_id=$2',
      [req.params.id, req.user.school_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });

    if (check.rows[0].to_id === req.user.id) {
      await pool.query(
        'UPDATE memos SET read_at = NOW() WHERE id=$1 AND read_at IS NULL',
        [req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE memo_cc SET read_at = NOW() WHERE memo_id=$1 AND user_id=$2 AND read_at IS NULL',
        [req.params.id, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
