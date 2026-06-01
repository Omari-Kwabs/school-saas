const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { notify } = require('../lib/notify');

const router = express.Router();

// Which audiences each role may SEE
function visibleAudiences(role) {
  if (['owner','headmaster_admin','headmaster_academics'].includes(role))
    return ['all','staff','teachers','heads','students'];
  if (role === 'department_head')
    return ['all','staff','teachers','heads'];
  if (['teacher','class_teacher'].includes(role))
    return ['all','staff','teachers','students'];
  // accountant, bursar, etc.
  return ['all','staff','heads'];
}

// Which audiences each role may POST to
function postableAudiences(role) {
  if (['owner','headmaster_admin','headmaster_academics'].includes(role))
    return ['all','staff','teachers','heads','students'];
  if (role === 'department_head')
    return ['teachers','heads'];
  if (['teacher','class_teacher'].includes(role))
    return ['students'];
  return [];
}

// GET / — active announcements visible to the current user's role
router.get('/', async (req, res) => {
  const audiences = visibleAudiences(req.user.role);
  try {
    const r = await pool.query(
      `SELECT a.*, u.name AS posted_by_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.posted_by
       WHERE a.school_id = $1
         AND a.is_active = true
         AND (a.expires_at IS NULL OR a.expires_at > NOW())
         AND a.audience = ANY($2)
       ORDER BY a.created_at DESC`,
      [req.user.school_id, audiences]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /all — all announcements (admins only)
router.get('/all', requirePrivilege('announcements:post'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT a.*, u.name AS posted_by_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.posted_by
       WHERE a.school_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC`,
      [req.user.school_id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST / — create announcement
router.post('/', requirePrivilege('announcements:post'), async (req, res) => {
  const { title, body, audience = 'all', expires_at } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  if (!postableAudiences(req.user.role).includes(audience))
    return res.status(403).json({ error: 'Forbidden: cannot post to this audience' });
  try {
    const r = await pool.query(
      `INSERT INTO announcements (school_id, posted_by, title, body, audience, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.school_id, req.user.id, title, body||null, audience, expires_at||null]
    );
    notify(req.user.school_id, 'announcement', { id: r.rows[0].id, title, audience, posted_by: req.user.name });
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /:id — edit or archive (must have posting privilege AND be poster or owner)
router.put('/:id', requirePrivilege('announcements:post'), async (req, res) => {
  const { title, body, audience, is_active, expires_at } = req.body;
  try {
    const check = await pool.query(
      'SELECT posted_by FROM announcements WHERE id=$1 AND school_id=$2',
      [req.params.id, req.user.school_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Not found' });
    const isOwner = req.user.role === 'owner';
    const isPoster = check.rows[0].posted_by === req.user.id;
    if (!isOwner && !isPoster) return res.status(403).json({ error: 'Forbidden' });

    const r = await pool.query(
      `UPDATE announcements SET title=$1, body=$2, audience=$3, is_active=$4, expires_at=$5
       WHERE id=$6 AND school_id=$7 RETURNING *`,
      [title, body||null, audience||'all', is_active !== undefined ? is_active : true,
       expires_at||null, req.params.id, req.user.school_id]
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /:id — soft-delete (deactivate + create deletion request)
router.delete('/:id', requirePrivilege('announcements:post'), async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE announcements SET is_active = false, deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND school_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [user_id, req.params.id, school_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found or already deactivated' });
    }

    const a = rows[0];
    await client.query(
      `INSERT INTO deletion_requests
         (school_id, entity_type, entity_id, entity_name, entity_snapshot, requested_by, reason)
       VALUES ($1,'announcement',$2,$3,$4,$5,$6)`,
      [school_id, a.id, a.title, a, user_id, reason || null]
    );

    await client.query('COMMIT');
    res.json({ success: true, deactivated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

module.exports = router;
