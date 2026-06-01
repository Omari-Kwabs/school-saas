const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const seedRoles = require('../utils/seedRoles');

const router = express.Router();

// All routes: owner only
router.use(requireRole('owner'));

const VALID_PRIVILEGES = [
  'finance:read','finance:write','academic:read','academic:write',
  'attendance:write','reports:read','users:manage','classes:manage',
  'timetable:manage','announcements:post','store:manage','feeding:write',
  'roles:manage','calendar:manage',
];

// List all roles + their privileges for this school
router.get('/', async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT sr.id, sr.name, sr.label, sr.is_system,
              COALESCE(
                ARRAY_AGG(rp.privilege ORDER BY rp.privilege)
                  FILTER (WHERE rp.privilege IS NOT NULL),
                '{}'
              ) AS privileges
       FROM school_roles sr
       LEFT JOIN role_privileges rp ON rp.role_id = sr.id
       WHERE sr.school_id = $1
       GROUP BY sr.id
       ORDER BY sr.is_system DESC, sr.name`,
      [school_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Seed default system roles (idempotent — safe to call on existing schools)
router.post('/seed', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedRoles(client, req.user.school_id);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

// Create a custom role
router.post('/', async (req, res) => {
  const { school_id } = req.user;
  const { label, privileges = [] } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });
  const name = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const invalid = privileges.filter(p => !VALID_PRIVILEGES.includes(p));
  if (invalid.length) {
    return res.status(400).json({ error: `Unknown privileges: ${invalid.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roleRes = await client.query(
      `INSERT INTO school_roles (school_id, name, label, is_system)
       VALUES ($1, $2, $3, FALSE) RETURNING *`,
      [school_id, name, label]
    );
    const roleId = roleRes.rows[0].id;
    for (const p of privileges) {
      await client.query(
        `INSERT INTO role_privileges (role_id, privilege) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, p]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ...roleRes.rows[0], privileges });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Role name already exists' });
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

// Update privileges for any role except owner
router.put('/:id/privileges', async (req, res) => {
  const { school_id } = req.user;
  const { privileges = [] } = req.body;

  const invalid = privileges.filter(p => !VALID_PRIVILEGES.includes(p));
  if (invalid.length) {
    return res.status(400).json({ error: `Unknown privileges: ${invalid.join(', ')}` });
  }

  const check = await pool.query(
    'SELECT id, name FROM school_roles WHERE id=$1 AND school_id=$2',
    [req.params.id, school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: 'Role not found' });
  if (check.rows[0].name === 'owner') return res.status(400).json({ error: 'Owner role privileges cannot be changed' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_privileges WHERE role_id=$1', [req.params.id]);
    for (const p of privileges) {
      await client.query(
        `INSERT INTO role_privileges (role_id, privilege) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [req.params.id, p]
      );
    }
    // Invalidate sessions for all users who hold this role
    await client.query(
      `UPDATE users SET token_version = token_version + 1
       WHERE school_id=$1 AND role=(SELECT name FROM school_roles WHERE id=$2)`,
      [school_id, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ success: true, privileges });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally { client.release(); }
});

// Delete a custom role (system roles are protected)
router.delete('/:id', async (req, res) => {
  const { school_id } = req.user;
  const check = await pool.query(
    'SELECT id, is_system FROM school_roles WHERE id=$1 AND school_id=$2',
    [req.params.id, school_id]
  );
  if (!check.rows.length) return res.status(404).json({ error: 'Role not found' });
  if (check.rows[0].is_system) return res.status(400).json({ error: 'Cannot delete a system role' });

  await pool.query('DELETE FROM school_roles WHERE id=$1 AND school_id=$2', [req.params.id, school_id]);
  res.json({ success: true });
});

module.exports = router;
