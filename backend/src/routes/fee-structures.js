const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');

const router = express.Router();

// Recompute total_amount from the sum of all items in a structure.
// Must be called within an open client transaction.
async function syncTotal(client, structure_id) {
  await client.query(
    `UPDATE fee_structures
     SET total_amount = COALESCE(
       (SELECT SUM(amount) FROM fee_structure_items WHERE fee_structure_id = $1), 0
     )
     WHERE id = $1`,
    [structure_id]
  );
}

// ─── Fee Items ───────────────────────────────────────────────────────────────
// These are reusable categories (Tuition, Books, Uniform …) scoped to a school.

router.get('/items', requirePrivilege('finance:read'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fee_items WHERE school_id = $1 ORDER BY name',
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/items', requirePrivilege('finance:write'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      'INSERT INTO fee_items (school_id, name) VALUES ($1,$2) RETURNING *',
      [req.user.school_id, name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Fee item name already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/items/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = await pool.query(
      'UPDATE fee_items SET name=$1 WHERE id=$2 AND school_id=$3 RETURNING *',
      [name, req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Fee item name already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/items/:id', requirePrivilege('finance:write'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM fee_items WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Fee item is used in a structure — remove it from all structures first' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Class breakdown (before /:id to avoid route shadowing) ──────────────────

router.get('/class/:class_id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  const conditions = ['fs.school_id = $1', 'fs.class_id = $2', 'fs.deleted_at IS NULL'];
  const params = [school_id, req.params.class_id];
  if (term_id) { params.push(term_id); conditions.push(`fs.term_id = $${params.length}`); }

  try {
    const structuresRes = await pool.query(
      `SELECT fs.*, t.name AS term_name
       FROM fee_structures fs
       LEFT JOIN terms t ON t.id = fs.term_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY fs.name`,
      params
    );
    if (!structuresRes.rows.length) return res.json([]);

    const ids = structuresRes.rows.map(s => s.id);
    const itemsRes = await pool.query(
      `SELECT fsi.fee_structure_id, fsi.id, fsi.fee_item_id,
              fi.name AS item_name, fsi.amount
       FROM fee_structure_items fsi
       JOIN fee_items fi ON fi.id = fsi.fee_item_id
       WHERE fsi.fee_structure_id = ANY($1)
       ORDER BY fi.name`,
      [ids]
    );

    const byStructure = {};
    for (const item of itemsRes.rows) {
      if (!byStructure[item.fee_structure_id]) byStructure[item.fee_structure_id] = [];
      byStructure[item.fee_structure_id].push(item);
    }

    res.json(structuresRes.rows.map(s => ({ ...s, items: byStructure[s.id] || [] })));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Fee Structures CRUD ──────────────────────────────────────────────────────

router.get('/', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id, term_id } = req.query;
  const conditions = ['fs.school_id = $1', 'fs.deleted_at IS NULL'];
  const params = [school_id];
  if (class_id) { params.push(class_id); conditions.push(`fs.class_id = $${params.length}`); }
  if (term_id)  { params.push(term_id);  conditions.push(`fs.term_id = $${params.length}`); }
  try {
    const result = await pool.query(
      `SELECT fs.*, c.name AS class_name, t.name AS term_name
       FROM fee_structures fs
       LEFT JOIN classes c ON c.id = fs.class_id
       LEFT JOIN terms t   ON t.id = fs.term_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.order_num, fs.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clone all fee structures from one term into another
router.post('/clone', requirePrivilege('finance:write'), async (req, res) => {
  const { school_id } = req.user;
  const { from_term_id, to_term_id } = req.body;
  if (!from_term_id || !to_term_id) {
    return res.status(400).json({ error: 'from_term_id and to_term_id required' });
  }
  if (from_term_id === to_term_id) {
    return res.status(400).json({ error: 'Cannot clone from and to the same term' });
  }
  // Verify both terms belong to this school
  const check = await pool.query(
    'SELECT id FROM terms WHERE id = ANY($1) AND school_id = $2',
    [[from_term_id, to_term_id], school_id],
  );
  if (check.rows.length !== 2) return res.status(404).json({ error: 'One or both terms not found' });

  // Load source structures with their line items
  const srcRes = await pool.query(
    `SELECT fs.*,
            COALESCE(
              json_agg(json_build_object('fee_item_id', fsi.fee_item_id, 'amount', fsi.amount))
              FILTER (WHERE fsi.id IS NOT NULL), '[]'
            ) AS items
     FROM fee_structures fs
     LEFT JOIN fee_structure_items fsi ON fsi.fee_structure_id = fs.id
     WHERE fs.school_id = $1 AND fs.term_id = $2
     GROUP BY fs.id`,
    [school_id, from_term_id],
  );
  if (!srcRes.rows.length) {
    return res.status(404).json({ error: 'No fee structures found in source term' });
  }

  // Get target term's academic_year
  const targetTerm = await pool.query(
    'SELECT academic_year FROM terms WHERE id=$1', [to_term_id]
  );
  const target_academic_year = targetTerm.rows[0]?.academic_year || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let cloned = 0;
    for (const src of srcRes.rows) {
      // Skip if an identical structure (same name + class) already exists in target term
      const dup = await client.query(
        `SELECT id FROM fee_structures
         WHERE school_id=$1 AND term_id=$2
           AND class_id IS NOT DISTINCT FROM $3 AND name=$4 LIMIT 1`,
        [school_id, to_term_id, src.class_id, src.name],
      );
      if (dup.rows.length) continue;

      const ns = await client.query(
        `INSERT INTO fee_structures
           (school_id, term_id, class_id, name, total_amount, fee_due_date, academic_year)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [school_id, to_term_id, src.class_id, src.name,
         src.total_amount, src.fee_due_date || null, target_academic_year],
      );
      for (const item of src.items) {
        await client.query(
          `INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [ns.rows[0].id, item.fee_item_id, item.amount],
        );
      }
      cloned++;
    }
    await client.query('COMMIT');
    res.json({ cloned });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Create structure — optionally accepts an items array for one-shot creation
router.post('/', requirePrivilege('finance:write'), async (req, res) => {
  const { name, class_id, term_id, items, fee_due_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  // Derive academic_year from the chosen term
  let academic_year = null;
  if (term_id) {
    const t = await pool.query('SELECT academic_year FROM terms WHERE id=$1', [term_id]);
    academic_year = t.rows[0]?.academic_year || null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const structRes = await client.query(
      `INSERT INTO fee_structures (school_id, class_id, term_id, name, fee_due_date, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.school_id, class_id || null, term_id || null, name,
       fee_due_date || null, academic_year],
    );
    const structure = structRes.rows[0];

    if (Array.isArray(items) && items.length) {
      for (const item of items) {
        await client.query(
          `INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount)
           VALUES ($1,$2,$3)`,
          [structure.id, item.fee_item_id, item.amount]
        );
      }
      await syncTotal(client, structure.id);
      const updated = await client.query('SELECT * FROM fee_structures WHERE id = $1', [structure.id]);
      await client.query('COMMIT');
      return res.status(201).json(updated.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json(structure);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get single structure with full item breakdown
router.get('/:id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const structRes = await pool.query(
      `SELECT fs.*, c.name AS class_name, t.name AS term_name
       FROM fee_structures fs
       LEFT JOIN classes c ON c.id = fs.class_id
       LEFT JOIN terms t   ON t.id = fs.term_id
       WHERE fs.id = $1 AND fs.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!structRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const itemsRes = await pool.query(
      `SELECT fsi.id, fsi.fee_item_id, fi.name AS item_name, fsi.amount
       FROM fee_structure_items fsi
       JOIN fee_items fi ON fi.id = fsi.fee_item_id
       WHERE fsi.fee_structure_id = $1
       ORDER BY fi.name`,
      [req.params.id]
    );

    res.json({ ...structRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update structure metadata
router.put('/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { name, class_id, term_id, fee_due_date } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  let academic_year = null;
  if (term_id) {
    const t = await pool.query('SELECT academic_year FROM terms WHERE id=$1', [term_id]);
    academic_year = t.rows[0]?.academic_year || null;
  }
  try {
    const result = await pool.query(
      `UPDATE fee_structures SET name=$1, class_id=$2, term_id=$3, fee_due_date=$4, academic_year=$5
       WHERE id=$6 AND school_id=$7 RETURNING *`,
      [name, class_id || null, term_id || null, fee_due_date || null, academic_year,
       req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requirePrivilege('finance:write'), async (req, res) => {
  const { school_id, id: user_id } = req.user;
  const { reason } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE fee_structures SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND school_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [user_id, req.params.id, school_id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found or already deactivated' });
    }

    const fs = rows[0];
    const className = fs.class_id ? (await client.query(
      `SELECT name FROM classes WHERE id = $1`, [fs.class_id]
    )).rows[0]?.name : null;
    const termName = fs.term_id ? (await client.query(
      `SELECT name FROM terms WHERE id = $1`, [fs.term_id]
    )).rows[0]?.name : null;

    await client.query(
      `INSERT INTO deletion_requests
         (school_id, entity_type, entity_id, entity_name, entity_snapshot, requested_by, reason)
       VALUES ($1,'fee_structure',$2,$3,$4,$5,$6)`,
      [school_id, fs.id, `${fs.name}${className ? ` (${className})` : ''}`,
       { ...fs, class_name: className, term_name: termName }, user_id, reason || null]
    );

    await client.query('COMMIT');
    res.json({ success: true, deactivated: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ─── Line-item management within a structure ──────────────────────────────────

// Add or update a line item (upsert by fee_item_id)
router.post('/:id/items', requirePrivilege('finance:write'), async (req, res) => {
  const { fee_item_id, amount } = req.body;
  if (!fee_item_id || amount == null) {
    return res.status(400).json({ error: 'fee_item_id and amount required' });
  }
  const { school_id } = req.user;

  const structCheck = await pool.query(
    'SELECT id FROM fee_structures WHERE id=$1 AND school_id=$2',
    [req.params.id, school_id]
  );
  if (!structCheck.rows.length) return res.status(404).json({ error: 'Structure not found' });

  const itemCheck = await pool.query(
    'SELECT id FROM fee_items WHERE id=$1 AND school_id=$2',
    [fee_item_id, school_id]
  );
  if (!itemCheck.rows.length) return res.status(404).json({ error: 'Fee item not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO fee_structure_items (fee_structure_id, fee_item_id, amount)
       VALUES ($1,$2,$3)
       ON CONFLICT (fee_structure_id, fee_item_id) DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [req.params.id, fee_item_id, amount]
    );
    await syncTotal(client, req.params.id);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Remove a line item from a structure
router.delete('/:id/items/:fee_item_id', requirePrivilege('finance:write'), async (req, res) => {
  const { school_id } = req.user;

  const structCheck = await pool.query(
    'SELECT id FROM fee_structures WHERE id=$1 AND school_id=$2',
    [req.params.id, school_id]
  );
  if (!structCheck.rows.length) return res.status(404).json({ error: 'Structure not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'DELETE FROM fee_structure_items WHERE fee_structure_id=$1 AND fee_item_id=$2 RETURNING id',
      [req.params.id, req.params.fee_item_id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not in structure' });
    }
    await syncTotal(client, req.params.id);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
