const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Build entity snapshot and name for each supported type
async function buildSnapshot(client, school_id, entity_type, entity_id) {
  switch (entity_type) {
    case 'class': {
      const { rows } = await client.query(
        `SELECT c.*,
                COUNT(s.id) AS student_count
         FROM classes c
         LEFT JOIN students s ON s.class_id = c.id
         WHERE c.id = $1 AND c.school_id = $2
         GROUP BY c.id`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: row.name, snapshot: row };
    }

    case 'expense': {
      const { rows } = await client.query(
        `SELECT e.*, u.name AS created_by_name
         FROM expenses e
         LEFT JOIN users u ON u.id = e.created_by
         WHERE e.id = $1 AND e.school_id = $2`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: `Receipt #${row.receipt_number} — ${row.description}`, snapshot: row };
    }

    case 'fee_structure': {
      const { rows } = await client.query(
        `SELECT fs.*,
                c.name AS class_name,
                t.name AS term_name,
                json_agg(
                  json_build_object('item_name', fi.name, 'amount', fsi.amount)
                  ORDER BY fi.name
                ) FILTER (WHERE fi.id IS NOT NULL) AS items
         FROM fee_structures fs
         LEFT JOIN classes c  ON c.id = fs.class_id
         LEFT JOIN terms   t  ON t.id = fs.term_id
         LEFT JOIN fee_structure_items fsi ON fsi.fee_structure_id = fs.id
         LEFT JOIN fee_items fi ON fi.id = fsi.fee_item_id
         WHERE fs.id = $1 AND fs.school_id = $2
         GROUP BY fs.id, c.name, t.name`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: `${row.name}${row.class_name ? ` (${row.class_name})` : ''}`, snapshot: row };
    }

    case 'announcement': {
      const { rows } = await client.query(
        `SELECT a.*, u.name AS posted_by_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.posted_by
         WHERE a.id = $1 AND a.school_id = $2`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: row.title, snapshot: row };
    }

    case 'student': {
      const { rows } = await client.query(
        `SELECT s.*, c.name AS class_name
         FROM students s
         LEFT JOIN classes c ON c.id = s.class_id
         WHERE s.id = $1 AND s.school_id = $2`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: row.name, snapshot: row };
    }

    case 'user': {
      const { rows } = await client.query(
        `SELECT id, name, email, username, role, is_active, created_at
         FROM users WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return { name: `${row.name} (${row.role})`, snapshot: row };
    }

    default:
      return null;
  }
}

// Check that entity is deactivated before a deletion request can be submitted
async function isDeactivated(client, school_id, entity_type, entity_id) {
  switch (entity_type) {
    case 'class':
    case 'expense':
    case 'fee_structure':
    case 'announcement': {
      const table = entity_type === 'fee_structure' ? 'fee_structures' : `${entity_type}s`;
      const { rows } = await client.query(
        `SELECT deleted_at FROM ${table} WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
      return rows.length > 0 && rows[0].deleted_at !== null;
    }
    case 'student': {
      const { rows } = await client.query(
        `SELECT status FROM students WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
      return rows.length > 0 && rows[0].status === 'inactive';
    }
    case 'user': {
      const { rows } = await client.query(
        `SELECT is_active FROM users WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
      return rows.length > 0 && rows[0].is_active === false;
    }
    default:
      return false;
  }
}

// Hard-delete the entity after owner approval
async function hardDelete(client, school_id, entity_type, entity_id) {
  switch (entity_type) {
    case 'class':
      // Unlink inactive students first so FK doesn't block
      await client.query(
        `UPDATE students SET class_id = NULL WHERE class_id = $1 AND school_id = $2 AND status = 'inactive'`,
        [entity_id, school_id]
      );
      return client.query(
        `DELETE FROM classes WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    case 'expense':
      return client.query(
        `DELETE FROM expenses WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    case 'fee_structure':
      return client.query(
        `DELETE FROM fee_structures WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    case 'announcement':
      return client.query(
        `DELETE FROM announcements WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    case 'student':
      return client.query(
        `DELETE FROM students WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    case 'user':
      return client.query(
        `DELETE FROM users WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );

    default:
      throw new Error(`Unknown entity_type: ${entity_type}`);
  }
}

// Restore entity (reject path)
async function restoreEntity(client, school_id, entity_type, entity_id) {
  switch (entity_type) {
    case 'class':
      return client.query(
        `UPDATE classes SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    case 'expense':
      return client.query(
        `UPDATE expenses SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    case 'fee_structure':
      return client.query(
        `UPDATE fee_structures SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    case 'announcement':
      return client.query(
        `UPDATE announcements SET deleted_at = NULL, deleted_by = NULL, is_active = true WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    case 'student':
      return client.query(
        `UPDATE students SET status = 'active' WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    case 'user':
      return client.query(
        `UPDATE users SET is_active = true WHERE id = $1 AND school_id = $2`,
        [entity_id, school_id]
      );
    default:
      throw new Error(`Unknown entity_type: ${entity_type}`);
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const VALID_TYPES = ['class', 'expense', 'fee_structure', 'announcement', 'student', 'user'];

// GET /api/deletion-requests — list requests (owner only)
router.get('/', requireRole('owner'), async (req, res) => {
  const { school_id } = req.user;
  const status = req.query.status || 'pending';
  try {
    const { rows } = await pool.query(
      `SELECT dr.*,
              ru.name AS requested_by_name,
              rv.name AS reviewed_by_name
       FROM deletion_requests dr
       LEFT JOIN users ru ON ru.id = dr.requested_by
       LEFT JOIN users rv ON rv.id = dr.reviewed_by
       WHERE dr.school_id = $1
         AND ($2 = 'all' OR dr.status = $2)
       ORDER BY dr.requested_at DESC`,
      [school_id, status]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/deletion-requests/:id/snapshot — get printable snapshot
router.get('/:id/snapshot', requireRole('owner'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const { rows } = await pool.query(
      `SELECT dr.*, ru.name AS requested_by_name
       FROM deletion_requests dr
       LEFT JOIN users ru ON ru.id = dr.requested_by
       WHERE dr.id = $1 AND dr.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/deletion-requests — submit a deletion request
// Called by DELETE endpoints internally (not directly by the client for entity-level routes)
// But also exposed so clients can submit for students/users from a deactivated-items list
router.post('/', async (req, res) => {
  const { entity_type, entity_id, reason } = req.body;
  const { school_id, id: user_id } = req.user;

  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'entity_type and entity_id required' });
  }
  if (!VALID_TYPES.includes(entity_type)) {
    return res.status(400).json({ error: `entity_type must be one of: ${VALID_TYPES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check entity exists + is deactivated
    const deactivated = await isDeactivated(client, school_id, entity_type, entity_id);
    if (!deactivated) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Entity must be deactivated before requesting deletion' });
    }

    // Check no pending request already exists for this entity
    const existing = await client.query(
      `SELECT id FROM deletion_requests
       WHERE school_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'pending'`,
      [school_id, entity_type, entity_id]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'A pending deletion request already exists for this record' });
    }

    // Build snapshot
    const result = await buildSnapshot(client, school_id, entity_type, entity_id);
    if (!result) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entity not found' });
    }

    const { rows } = await client.query(
      `INSERT INTO deletion_requests
         (school_id, entity_type, entity_id, entity_name, entity_snapshot, requested_by, reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [school_id, entity_type, entity_id, result.name, result.snapshot, user_id, reason || null]
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/deletion-requests/:id/approve — owner permanently deletes the entity
router.put('/:id/approve', requireRole('owner'), async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { review_notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM deletion_requests WHERE id = $1 AND school_id = $2 AND status = 'pending'`,
      [req.params.id, school_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending deletion request not found' });
    }
    const dr = rows[0];

    await hardDelete(client, school_id, dr.entity_type, dr.entity_id);

    await client.query(
      `UPDATE deletion_requests SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
       WHERE id = $3`,
      [user_id, review_notes || null, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/deletion-requests/:id/reject — owner rejects; entity is restored
router.put('/:id/reject', requireRole('owner'), async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { review_notes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM deletion_requests WHERE id = $1 AND school_id = $2 AND status = 'pending'`,
      [req.params.id, school_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending deletion request not found' });
    }
    const dr = rows[0];

    await restoreEntity(client, school_id, dr.entity_type, dr.entity_id);

    await client.query(
      `UPDATE deletion_requests SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2
       WHERE id = $3`,
      [user_id, review_notes || null, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
