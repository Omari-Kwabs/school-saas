const express = require('express');
const pool = require('../config/db');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');

const router = express.Router();

// Derive Sep–Aug academic year from a date string
function deriveAcademicYear(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// Validate non-overlapping dates within a school (excluding current id)
async function checkOverlap(school_id, start_date, end_date, excludeId = null) {
  if (!start_date || !end_date) return false;
  const params = [school_id, start_date, end_date];
  let q = `SELECT id FROM terms
           WHERE school_id = $1
             AND start_date IS NOT NULL AND end_date IS NOT NULL
             AND start_date < $3 AND end_date > $2`;
  if (excludeId) { params.push(excludeId); q += ` AND id != $${params.length}`; }
  const r = await pool.query(q, params);
  return r.rows.length > 0;
}

// Compute status from stored fields and today
function computeStatus(t, today) {
  if (t.is_current) return 'active';
  if (!t.start_date || !t.end_date) return 'draft';
  const start = new Date(t.start_date);
  const end   = new Date(t.end_date);
  if (end < today) return 'ended';
  if (start > today) return 'upcoming';
  return 'inactive'; // dates include today but not marked current
}

// Sync term_start / term_end events into school_events for a given term.
// Must be called inside an open client transaction.
async function syncCalendarEvents(client, school_id, term, user_id) {
  if (!term.start_date || !term.end_date || !term.id) return;
  // Remove stale auto-synced events for this term, then re-insert fresh ones.
  await client.query(
    `DELETE FROM school_events WHERE school_id=$1 AND term_id=$2`,
    [school_id, term.id],
  );
  await client.query(
    `INSERT INTO school_events (school_id, title, event_type, start_date, term_id, created_by)
     VALUES ($1,$2,'term_start',$3,$4,$5),($1,$6,'term_end',$7,$4,$5)`,
    [school_id,
     `${term.name} Begins`, term.start_date,
     term.id, user_id,
     `${term.name} Ends`,   term.end_date],
  );
}

// Run batch carry-forward for all students moving from prev_term into new_term
async function batchCarryForward(client, school_id, prev_term_id, new_term_id, new_term_start, created_by) {
  // Find students who have a plan in new_term but no carry-forward yet from prev_term
  const { rows } = await client.query(
    `SELECT pp.student_id,
            pp.total_amount,
            COALESCE(SUM(p.amount), 0) AS total_paid,
            COALESCE(cf_in.cf_in_total, 0) AS carry_forward_in
     FROM payment_plans pp
     LEFT JOIN payments p ON p.plan_id = pp.id
     LEFT JOIN (
       SELECT student_id, to_term_id, SUM(amount) AS cf_in_total
       FROM fee_carry_forwards WHERE school_id = $1
       GROUP BY student_id, to_term_id
     ) cf_in ON cf_in.student_id = pp.student_id AND cf_in.to_term_id = pp.term_id
     WHERE pp.school_id = $1 AND pp.term_id = $2
       -- must also have a plan in new term
       AND EXISTS (
         SELECT 1 FROM payment_plans pp2
         WHERE pp2.school_id = $1 AND pp2.student_id = pp.student_id AND pp2.term_id = $3
       )
       -- no carry-forward from prev_term yet
       AND NOT EXISTS (
         SELECT 1 FROM fee_carry_forwards cf2
         WHERE cf2.school_id = $1 AND cf2.student_id = pp.student_id AND cf2.from_term_id = $2
       )
     GROUP BY pp.student_id, pp.total_amount, cf_in.cf_in_total`,
    [school_id, prev_term_id, new_term_id]
  );

  let count = 0;
  for (const row of rows) {
    const balance = Math.round(
      (parseFloat(row.total_amount) - parseFloat(row.total_paid) + parseFloat(row.carry_forward_in)) * 100
    ) / 100;
    if (Math.abs(balance) < 0.01) continue;
    await client.query(
      `INSERT INTO fee_carry_forwards
         (school_id, student_id, from_term_id, to_term_id, amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (school_id, student_id, from_term_id) DO NOTHING`,
      [school_id, row.student_id, prev_term_id, new_term_id, balance,
       'Auto-applied on term activation', created_by]
    );
    count++;
  }
  return count;
}

// ── GET / — list active terms with computed status ────────────────────────────
router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.include_archived === 'true';
    const conditions = ['school_id = $1'];
    if (!includeArchived) conditions.push('is_archived = false');
    const result = await pool.query(
      `SELECT * FROM terms WHERE ${conditions.join(' AND ')} ORDER BY start_date ASC NULLS LAST`,
      [req.user.school_id]
    );
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Add status + term_number (1,2,3 within each academic year)
    const countByYear = {};
    const rows = result.rows.map(t => {
      const yr = t.academic_year || 'Unknown';
      countByYear[yr] = (countByYear[yr] || 0) + 1;
      return { ...t, status: computeStatus(t, today), term_number: countByYear[yr] };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /archived — summary by academic year ──────────────────────────────────
router.get('/archived', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT academic_year,
              COUNT(*)::int   AS term_count,
              MIN(start_date) AS from_date,
              MAX(end_date)   AS to_date
       FROM terms
       WHERE school_id = $1 AND is_archived = true
       GROUP BY academic_year
       ORDER BY academic_year DESC`,
      [req.user.school_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /scaffold — create all terms for an academic year in one shot ─────────
router.post('/scaffold', requirePrivilege('classes:manage'), async (req, res) => {
  const { terms: termDefs } = req.body;
  const { school_id, id: user_id } = req.user;

  if (!Array.isArray(termDefs) || termDefs.length === 0) {
    return res.status(400).json({ error: 'terms array required' });
  }
  for (const t of termDefs) {
    if (!t.name || !t.start_date || !t.end_date) {
      return res.status(400).json({ error: 'Each term requires name, start_date, and end_date' });
    }
    if (new Date(t.end_date) <= new Date(t.start_date)) {
      return res.status(400).json({ error: `${t.name}: end_date must be after start_date` });
    }
  }

  // Check for overlaps among the submitted terms themselves
  for (let i = 0; i < termDefs.length; i++) {
    for (let j = i + 1; j < termDefs.length; j++) {
      const a = termDefs[i], b = termDefs[j];
      if (new Date(a.start_date) < new Date(b.end_date) &&
          new Date(a.end_date)   > new Date(b.start_date)) {
        return res.status(400).json({ error: `${a.name} and ${b.name} dates overlap` });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const t of termDefs) {
      const overlap = await checkOverlap(school_id, t.start_date, t.end_date);
      if (overlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `${t.name}: dates overlap with an existing term` });
      }
      const yr = deriveAcademicYear(t.start_date);
      const r = await client.query(
        `INSERT INTO terms (school_id, name, start_date, end_date, is_current, academic_year)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [school_id, t.name, t.start_date, t.end_date, false, yr]
      );
      const created_term = r.rows[0];
      await syncCalendarEvents(client, school_id, created_term, user_id);
      created.push(created_term);
    }
    await client.query('COMMIT');
    audit(req, 'CREATE', 'terms_scaffold', school_id, { count: created.length });
    res.status(201).json(created);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/activate — make this the current term ───────────────────────────
// Also auto-carries forward outstanding balances from the previous term
router.post('/:id/activate', requirePrivilege('classes:manage'), async (req, res) => {
  const { school_id, id: user_id } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find what term is currently active (before we switch)
    const prevRes = await client.query(
      'SELECT id, name FROM terms WHERE school_id = $1 AND is_current = true LIMIT 1',
      [school_id]
    );
    const prevTerm = prevRes.rows[0] || null;

    // Deactivate all terms
    await client.query('UPDATE terms SET is_current = false WHERE school_id = $1', [school_id]);

    // Activate the chosen term
    const result = await client.query(
      `UPDATE terms SET is_current = true
       WHERE id = $1 AND school_id = $2 RETURNING *`,
      [req.params.id, school_id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Term not found' });
    }
    const newTerm = result.rows[0];

    // Ensure calendar events exist / are up-to-date for the activated term
    await syncCalendarEvents(client, school_id, newTerm, user_id);

    // Batch carry-forward from previous term if there was one
    let carry_forwards_created = 0;
    if (prevTerm && prevTerm.id !== newTerm.id && newTerm.start_date) {
      carry_forwards_created = await batchCarryForward(
        client, school_id, prevTerm.id, newTerm.id, newTerm.start_date, user_id
      );
    }

    await client.query('COMMIT');
    audit(req, 'ACTIVATE', 'term', newTerm.id, { name: newTerm.name, carry_forwards_created });
    res.json({ ...newTerm, carry_forwards_created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/close — end the current term ────────────────────────────────────
router.post('/:id/close', requirePrivilege('classes:manage'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `UPDATE terms SET is_current = false
       WHERE id = $1 AND school_id = $2 RETURNING *`,
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Term not found' });

    // Count students with outstanding balances in this term
    const outstandingRes = await pool.query(
      `SELECT COUNT(DISTINCT pp.student_id)::int AS count
       FROM payment_plans pp
       LEFT JOIN (
         SELECT plan_id, SUM(amount) AS paid FROM payments WHERE school_id = $1 GROUP BY plan_id
       ) sub ON sub.plan_id = pp.id
       LEFT JOIN (
         SELECT student_id, to_term_id, SUM(amount) AS cf_total
         FROM fee_carry_forwards WHERE school_id = $1 GROUP BY student_id, to_term_id
       ) cf_agg ON cf_agg.student_id = pp.student_id AND cf_agg.to_term_id = pp.term_id
       WHERE pp.school_id = $1 AND pp.term_id = $2
         AND pp.total_amount - COALESCE(sub.paid, 0) + COALESCE(cf_agg.cf_total, 0) > 0.005`,
      [school_id, req.params.id]
    );

    audit(req, 'CLOSE', 'term', req.params.id, { name: result.rows[0].name });
    res.json({
      ...result.rows[0],
      outstanding_students: outstandingRes.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST / — create single term ───────────────────────────────────────────────
router.post('/', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, start_date, end_date, is_current, academic_year } = req.body;
  const { school_id } = req.user;

  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date required' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (await checkOverlap(school_id, start_date, end_date)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'These dates overlap with an existing term' });
    }

    if (is_current) {
      await client.query('UPDATE terms SET is_current = false WHERE school_id = $1', [school_id]);
    }

    const yr = academic_year || deriveAcademicYear(start_date);
    const result = await client.query(
      `INSERT INTO terms (school_id, name, start_date, end_date, is_current, academic_year)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [school_id, name, start_date, end_date, is_current || false, yr]
    );
    const newTerm = result.rows[0];
    await syncCalendarEvents(client, school_id, newTerm, req.user.id);
    await client.query('COMMIT');
    res.status(201).json(newTerm);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── PUT /:id — edit term dates/name ──────────────────────────────────────────
router.put('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  const { name, start_date, end_date, academic_year } = req.body;
  const { school_id } = req.user;

  if (!name || !start_date || !end_date) {
    return res.status(400).json({ error: 'name, start_date, and end_date required' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (await checkOverlap(school_id, start_date, end_date, req.params.id)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'These dates overlap with another term' });
    }

    const yr = academic_year || deriveAcademicYear(start_date);
    const result = await client.query(
      `UPDATE terms SET name=$1, start_date=$2, end_date=$3, academic_year=$4
       WHERE id=$5 AND school_id=$6 RETURNING *`,
      [name, start_date, end_date, yr, req.params.id, school_id]
    );
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    await syncCalendarEvents(client, school_id, result.rows[0], req.user.id);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /:id/archive / unarchive ─────────────────────────────────────────────
router.post('/:id/archive', requirePrivilege('classes:manage'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE terms SET is_archived = true, is_current = false WHERE id=$1 AND school_id=$2 RETURNING *`,
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/unarchive', requirePrivilege('classes:manage'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE terms SET is_archived = false WHERE id=$1 AND school_id=$2 RETURNING *`,
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/archive-year', requirePrivilege('classes:manage'), async (req, res) => {
  const { academic_year } = req.body;
  if (!academic_year) return res.status(400).json({ error: 'academic_year required' });
  try {
    const result = await pool.query(
      `UPDATE terms SET is_archived = true, is_current = false
       WHERE school_id=$1 AND academic_year=$2 RETURNING id`,
      [req.user.school_id, academic_year]
    );
    res.json({ archived: result.rowCount });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/unarchive-year', requirePrivilege('classes:manage'), async (req, res) => {
  const { academic_year } = req.body;
  if (!academic_year) return res.status(400).json({ error: 'academic_year required' });
  try {
    const result = await pool.query(
      `UPDATE terms SET is_archived = false WHERE school_id=$1 AND academic_year=$2 RETURNING id`,
      [req.user.school_id, academic_year]
    );
    res.json({ unarchived: result.rowCount });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', requirePrivilege('classes:manage'), async (req, res) => {
  try {
    // Block deletion if plans exist for this term
    const planCheck = await pool.query(
      'SELECT id FROM payment_plans WHERE term_id=$1 AND school_id=$2 LIMIT 1',
      [req.params.id, req.user.school_id]
    );
    if (planCheck.rows.length) {
      return res.status(409).json({ error: 'Cannot delete a term that has payment plans. Archive it instead.' });
    }
    const result = await pool.query(
      'DELETE FROM terms WHERE id=$1 AND school_id=$2 RETURNING id',
      [req.params.id, req.user.school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
