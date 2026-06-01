const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const { generateSchedule } = require('../utils/scheduleGenerator');
const audit = require('../middleware/audit');

const router = express.Router();

// Given a schedule and total paid so far, mark each installment as
// paid / partial / overdue / upcoming (payments are allocated FIFO by due_date).
function annotateSchedule(scheduleRows, totalPaid, today) {
  let remaining = parseFloat(totalPaid);
  return scheduleRows.map(row => {
    const due    = parseFloat(row.amount_due);
    const isPast = new Date(row.due_date) < today;
    let status, amount_paid;
    if (remaining >= due) {
      remaining   = Math.round((remaining - due) * 100) / 100;
      status      = 'paid';
      amount_paid = due;
    } else if (remaining > 0) {
      amount_paid = remaining;
      remaining   = 0;
      status      = isPast ? 'overdue' : 'partial';
    } else {
      amount_paid = 0;
      status      = isPast ? 'overdue' : 'upcoming';
    }
    return { ...row, amount_paid, status };
  });
}

// ─── Carry-forward helper ─────────────────────────────────────────────────────
// Finds the student's most recent prior payment plan (term ended before new_term_start_date),
// computes its effective outstanding balance (plan balance + any carry-forwards already into it),
// and creates a fee_carry_forwards record into to_term_id.
// Runs inside an existing transaction (client). Returns the created row, or null if skipped.
async function autoCarryForward(client, school_id, student_id, to_term_id, new_term_start_date, created_by) {
  const prevRes = await client.query(
    `SELECT pp.id, pp.total_amount, pp.term_id AS from_term_id,
            COALESCE(SUM(p.amount), 0)          AS total_paid,
            COALESCE(cf_in.cf_total, 0)         AS carry_forward_in
     FROM payment_plans pp
     JOIN terms t ON t.id = pp.term_id
     LEFT JOIN payments p ON p.plan_id = pp.id
     LEFT JOIN (
       SELECT to_term_id, student_id, SUM(amount) AS cf_total
       FROM fee_carry_forwards WHERE school_id = $1
       GROUP BY to_term_id, student_id
     ) cf_in ON cf_in.to_term_id = pp.term_id AND cf_in.student_id = pp.student_id
     WHERE pp.school_id = $1 AND pp.student_id = $2
       AND t.end_date < $3
     GROUP BY pp.id, pp.total_amount, pp.term_id, cf_in.cf_total
     ORDER BY t.end_date DESC
     LIMIT 1`,
    [school_id, student_id, new_term_start_date]
  );

  if (!prevRes.rows.length) return null;

  const prev = prevRes.rows[0];
  // effective = (term fees - payments) + carry-forwards that came INTO that prior term
  const effective_balance = Math.round(
    (parseFloat(prev.total_amount) - parseFloat(prev.total_paid) + parseFloat(prev.carry_forward_in)) * 100
  ) / 100;

  if (Math.abs(effective_balance) < 0.01) return null; // already settled

  const cfRes = await client.query(
    `INSERT INTO fee_carry_forwards
       (school_id, student_id, from_term_id, to_term_id, amount, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (school_id, student_id, from_term_id) DO NOTHING
     RETURNING *`,
    [school_id, student_id, prev.from_term_id, to_term_id, effective_balance,
     'Auto-generated when payment plan was created', created_by]
  );
  return cfRes.rows[0] || null;
}

// ─── Payment Plans ────────────────────────────────────────────────────────────

// Create plan — schedule is auto-generated and persisted
router.post('/plans', requirePrivilege('finance:write'), async (req, res) => {
  const { student_id, fee_structure_id, term_id, plan_type, total_amount, start_date } = req.body;
  const { school_id } = req.user;
  if (!student_id || !term_id || !plan_type || total_amount == null || !start_date) {
    return res.status(400).json({
      error: 'student_id, term_id, plan_type, total_amount and start_date required'
    });
  }

  let termRes;
  try {
    termRes = await pool.query(
      'SELECT start_date, end_date FROM terms WHERE id = $1 AND school_id = $2',
      [term_id, school_id]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  if (!termRes.rows.length) return res.status(404).json({ error: 'Term not found' });

  const term = termRes.rows[0];
  let schedule;
  try {
    schedule = generateSchedule(plan_type, total_amount, start_date, term.end_date);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planRes = await client.query(
      `INSERT INTO payment_plans
         (school_id, student_id, fee_structure_id, term_id, plan_type, total_amount, start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [school_id, student_id, fee_structure_id || null, term_id, plan_type, total_amount, start_date]
    );
    const plan = planRes.rows[0];
    for (const s of schedule) {
      await client.query(
        `INSERT INTO payment_schedules (plan_id, school_id, student_id, installment_num, due_date, amount_due)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [plan.id, school_id, student_id, s.installment_num, s.due_date, s.amount_due]
      );
    }

    const cf = await autoCarryForward(client, school_id, student_id, term_id, term.start_date, req.user.id);

    await client.query('COMMIT');
    audit(req, 'CREATE', 'payment_plan', plan.id, { student_id, term_id, total_amount });
    res.status(201).json({ ...plan, schedule, carry_forward: cf || null });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Student already has a payment plan for this term' });
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Bulk create plans — one per student in a class; existing plans for the term are skipped
router.post('/plans/bulk', requirePrivilege('finance:write'), async (req, res) => {
  const { class_id, term_id, fee_structure_id, plan_type, total_amount, start_date } = req.body;
  const { school_id } = req.user;

  if (!class_id || !term_id || !plan_type || total_amount == null || !start_date) {
    return res.status(400).json({
      error: 'class_id, term_id, plan_type, total_amount and start_date required',
    });
  }

  let termRes, studentsRes, existingRes;
  try {
    termRes = await pool.query(
      'SELECT start_date, end_date FROM terms WHERE id = $1 AND school_id = $2',
      [term_id, school_id]
    );
    if (!termRes.rows.length) return res.status(404).json({ error: 'Term not found' });

    studentsRes = await pool.query(
      'SELECT id FROM students WHERE class_id = $1 AND school_id = $2',
      [class_id, school_id]
    );
    if (!studentsRes.rows.length) {
      return res.status(404).json({ error: 'No students found in this class' });
    }

    const studentIds = studentsRes.rows.map(r => r.id);
    existingRes = await pool.query(
      'SELECT student_id FROM payment_plans WHERE term_id = $1 AND school_id = $2 AND student_id = ANY($3)',
      [term_id, school_id, studentIds]
    );
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }

  const term = termRes.rows[0];
  let schedule;
  try {
    schedule = generateSchedule(plan_type, total_amount, start_date, term.end_date);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid plan configuration' });
  }

  const existingSet = new Set(existingRes.rows.map(r => r.student_id));
  const toCreate = studentsRes.rows.filter(r => !existingSet.has(r.id));
  const totalStudents = studentsRes.rows.length;

  if (!toCreate.length) {
    return res.json({ created: 0, skipped: totalStudents, total: totalStudents, carry_forwards: 0 });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    let carry_forwards = 0;
    for (const student of toCreate) {
      const planRes = await dbClient.query(
        `INSERT INTO payment_plans
           (school_id, student_id, fee_structure_id, term_id, plan_type, total_amount, start_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [school_id, student.id, fee_structure_id || null, term_id, plan_type, total_amount, start_date]
      );
      for (const s of schedule) {
        await dbClient.query(
          `INSERT INTO payment_schedules (plan_id, school_id, student_id, installment_num, due_date, amount_due)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [planRes.rows[0].id, school_id, student.id, s.installment_num, s.due_date, s.amount_due]
        );
      }
      const cf = await autoCarryForward(dbClient, school_id, student.id, term_id, term.start_date, req.user.id);
      if (cf) carry_forwards++;
    }
    await dbClient.query('COMMIT');
    res.status(201).json({ created: toCreate.length, skipped: existingSet.size, total: totalStudents, carry_forwards });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
});

// List plans — filtered by student_id, term_id, and/or class_id; includes balance summary
router.get('/plans', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, term_id, class_id } = req.query;
  const conditions = ['pp.school_id = $1'];
  const params = [school_id];
  if (student_id) { params.push(student_id); conditions.push(`pp.student_id = $${params.length}`); }
  if (term_id)    { params.push(term_id);    conditions.push(`pp.term_id    = $${params.length}`); }
  if (class_id)   { params.push(class_id);   conditions.push(`s.class_id   = $${params.length}`); }
  try {
    const result = await pool.query(
      `SELECT pp.id, pp.student_id, pp.plan_type, pp.total_amount, pp.start_date,
              s.name AS student_name, c.name AS class_name, t.name AS term_name,
              COALESCE(SUM(p.amount), 0)                                            AS total_paid,
              pp.total_amount - COALESCE(SUM(p.amount), 0)                         AS balance,
              COALESCE(cf_agg.carry_forward_total, 0)                              AS carry_forward,
              pp.total_amount - COALESCE(SUM(p.amount), 0)
                + COALESCE(cf_agg.carry_forward_total, 0)                          AS effective_balance,
              GREATEST(0,
                COALESCE((SELECT SUM(ps.amount_due) FROM payment_schedules ps
                          WHERE ps.plan_id = pp.id AND ps.due_date < CURRENT_DATE), 0)
                - COALESCE(SUM(p.amount), 0)
              )                                                                     AS overdue_amount
       FROM payment_plans pp
       JOIN students s      ON s.id = pp.student_id
       LEFT JOIN classes c  ON c.id = s.class_id
       JOIN terms t         ON t.id = pp.term_id
       LEFT JOIN payments p ON p.plan_id = pp.id
       LEFT JOIN (
         SELECT student_id, to_term_id, SUM(amount) AS carry_forward_total
         FROM fee_carry_forwards WHERE school_id = $1
         GROUP BY student_id, to_term_id
       ) cf_agg ON cf_agg.student_id = pp.student_id AND cf_agg.to_term_id = pp.term_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pp.id, pp.student_id, s.name, c.name, t.name, cf_agg.carry_forward_total
       ORDER BY s.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/payments/analytics — financial summary + class and method breakdown
router.get('/analytics', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id, class_id } = req.query;

  const params = [school_id];
  let planFilter = 'pp.school_id = $1';
  if (term_id)  { params.push(term_id);  planFilter += ` AND pp.term_id  = $${params.length}`; }
  if (class_id) { params.push(class_id); planFilter += ` AND s.class_id  = $${params.length}`; }

  try {
    const [totalsRes, byClassRes, byMethodRes] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(pp.total_amount), 0)
            + COALESCE(SUM(cf_agg.cf_total), 0)     AS total_billed,
          COALESCE(SUM(sub.paid), 0)                 AS total_collected,
          GREATEST(0,
            COALESCE(SUM(ps_due.overdue_expected), 0)
            - COALESCE(SUM(sub.paid), 0)
          )                                          AS overdue_amount
        FROM payment_plans pp
        JOIN students s ON s.id = pp.student_id
        LEFT JOIN (
          SELECT plan_id, SUM(amount) AS paid
          FROM payments WHERE school_id = $1 GROUP BY plan_id
        ) sub ON sub.plan_id = pp.id
        LEFT JOIN (
          SELECT plan_id, SUM(amount_due) AS overdue_expected
          FROM payment_schedules WHERE due_date < CURRENT_DATE GROUP BY plan_id
        ) ps_due ON ps_due.plan_id = pp.id
        LEFT JOIN (
          SELECT student_id, to_term_id, SUM(amount) AS cf_total
          FROM fee_carry_forwards WHERE school_id = $1
          GROUP BY student_id, to_term_id
        ) cf_agg ON cf_agg.student_id = pp.student_id AND cf_agg.to_term_id = pp.term_id
        WHERE ${planFilter}
      `, params),

      pool.query(`
        SELECT
          COALESCE(c.name, 'No Class')                                           AS class_name,
          COUNT(DISTINCT pp.student_id)                                           AS student_count,
          COALESCE(SUM(pp.total_amount), 0)
            + COALESCE(SUM(cf_agg.cf_total), 0)                                  AS total_billed,
          COALESCE(SUM(sub.paid), 0)                                              AS total_collected,
          COALESCE(SUM(pp.total_amount), 0) + COALESCE(SUM(cf_agg.cf_total), 0)
            - COALESCE(SUM(sub.paid), 0)                                          AS outstanding
        FROM payment_plans pp
        JOIN students s ON s.id = pp.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN (
          SELECT plan_id, SUM(amount) AS paid
          FROM payments WHERE school_id = $1 GROUP BY plan_id
        ) sub ON sub.plan_id = pp.id
        LEFT JOIN (
          SELECT student_id, to_term_id, SUM(amount) AS cf_total
          FROM fee_carry_forwards WHERE school_id = $1
          GROUP BY student_id, to_term_id
        ) cf_agg ON cf_agg.student_id = pp.student_id AND cf_agg.to_term_id = pp.term_id
        WHERE ${planFilter}
        GROUP BY c.id, c.name
        ORDER BY c.name
      `, params),

      pool.query(`
        SELECT
          COALESCE(method, 'unknown') AS method,
          COUNT(*)                    AS count,
          COALESCE(SUM(amount), 0)    AS total
        FROM payments
        WHERE school_id = $1
        GROUP BY method
        ORDER BY total DESC
      `, [school_id]),
    ]);

    const t = totalsRes.rows[0];
    const totalBilled    = parseFloat(t.total_billed);
    const totalCollected = parseFloat(t.total_collected);
    const netOutstanding = totalBilled - totalCollected;

    res.json({
      summary: {
        total_billed:    totalBilled,
        total_collected: totalCollected,
        outstanding:     Math.max(0, netOutstanding),
        credit_balance:  Math.max(0, -netOutstanding), // schools owe students
        overdue:         parseFloat(t.overdue_amount),
      },
      by_class: byClassRes.rows.map(r => ({
        class_name:      r.class_name,
        student_count:   parseInt(r.student_count),
        total_billed:    parseFloat(r.total_billed),
        total_collected: parseFloat(r.total_collected),
        outstanding:     Math.max(0, parseFloat(r.outstanding)),
        collection_rate: parseFloat(r.total_billed) > 0
          ? Math.min(100, Math.round((parseFloat(r.total_collected) / parseFloat(r.total_billed)) * 100))
          : 0,
      })),
      by_method: byMethodRes.rows.map(r => ({
        method: r.method,
        count:  parseInt(r.count),
        total:  parseFloat(r.total),
      })),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single plan — full schedule with per-installment status + payment history
router.get('/plans/:id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const planRes = await pool.query(
      `SELECT pp.*, s.name AS student_name, c.name AS class_name, t.name AS term_name
       FROM payment_plans pp
       JOIN students s     ON s.id = pp.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       JOIN terms t        ON t.id = pp.term_id
       WHERE pp.id = $1 AND pp.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!planRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const plan = planRes.rows[0];

    const [schedRes, paymentsRes] = await Promise.all([
      pool.query(
        'SELECT * FROM payment_schedules WHERE plan_id = $1 ORDER BY installment_num',
        [req.params.id]
      ),
      pool.query(
        'SELECT * FROM payments WHERE plan_id = $1 ORDER BY payment_date, id',
        [req.params.id]
      )
    ]);

    const total_paid = paymentsRes.rows.reduce((s, p) => s + parseFloat(p.amount), 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue_expected = schedRes.rows
      .filter(s => new Date(s.due_date) < today)
      .reduce((s, r) => s + parseFloat(r.amount_due), 0);

    res.json({
      ...plan,
      total_paid:     Math.round(total_paid * 100) / 100,
      balance:        Math.round((parseFloat(plan.total_amount) - total_paid) * 100) / 100,
      overdue_amount: Math.max(0, Math.round((overdue_expected - total_paid) * 100) / 100),
      schedule:       annotateSchedule(schedRes.rows, total_paid, today),
      payments:       paymentsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────

// Record a payment against a plan
router.post('/', requirePrivilege('finance:write'), async (req, res) => {
  const { student_id, plan_id, amount, payment_date, method, receipt_number, notes } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id || amount == null) {
    return res.status(400).json({ error: 'student_id and amount required' });
  }
  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  if (plan_id) {
    // Verify the plan belongs to this student and school — overpayment is allowed (becomes credit B/F)
    const check = await pool.query(
      'SELECT id FROM payment_plans WHERE id=$1 AND school_id=$2 AND student_id=$3',
      [plan_id, school_id, student_id]
    );
    if (!check.rows.length) return res.status(404).json({ error: 'Plan not found' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO payments
         (school_id, student_id, plan_id, amount, payment_date, method, receipt_number, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [school_id, student_id, plan_id || null, amount,
       payment_date || new Date().toISOString().split('T')[0],
       method || null, receipt_number || null, notes || null, recorded_by]
    );
    audit(req, 'CREATE', 'payment', result.rows[0].id, { student_id, amount, method });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List payments — filtered by student_id and/or plan_id
router.get('/', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { student_id, plan_id } = req.query;
  const conditions = ['p.school_id = $1'];
  const params = [school_id];
  if (student_id) { params.push(student_id); conditions.push(`p.student_id = $${params.length}`); }
  if (plan_id)    { params.push(plan_id);    conditions.push(`p.plan_id    = $${params.length}`); }
  try {
    const result = await pool.query(
      `SELECT p.*, s.name AS student_name,
              fs.name AS fee_structure_name
       FROM payments p
       JOIN students s ON s.id = p.student_id
       LEFT JOIN payment_plans pp ON pp.id = p.plan_id
       LEFT JOIN fee_structures fs ON fs.id = pp.fee_structure_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.payment_date DESC, p.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Balance & Debtors ────────────────────────────────────────────────────────

// Student balance — one row per active payment plan
router.get('/balance/:student_id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  const conditions = ['pp.school_id = $1', 'pp.student_id = $2'];
  const params = [school_id, req.params.student_id];
  if (term_id) { params.push(term_id); conditions.push(`pp.term_id = $${params.length}`); }
  try {
    const result = await pool.query(
      `WITH paid AS (
         SELECT plan_id, SUM(amount) AS total_paid
         FROM payments
         WHERE school_id = $1 AND student_id = $2
         GROUP BY plan_id
       ),
       overdue AS (
         SELECT plan_id, SUM(amount_due) AS overdue_expected
         FROM payment_schedules
         WHERE due_date < CURRENT_DATE
         GROUP BY plan_id
       )
       SELECT pp.id, pp.plan_type, pp.total_amount, pp.start_date, t.name AS term_name,
              COALESCE(pd.total_paid, 0)                                        AS total_paid,
              pp.total_amount - COALESCE(pd.total_paid, 0)                      AS balance,
              GREATEST(0, COALESCE(od.overdue_expected, 0) - COALESCE(pd.total_paid, 0))
                                                                                AS overdue_amount,
              (SELECT json_build_object('due_date', ps.due_date, 'amount_due', ps.amount_due)
               FROM payment_schedules ps
               WHERE ps.plan_id = pp.id AND ps.due_date >= CURRENT_DATE
               ORDER BY ps.due_date ASC LIMIT 1)                               AS next_installment
       FROM payment_plans pp
       JOIN terms t ON t.id = pp.term_id
       LEFT JOIN paid pd   ON pd.plan_id   = pp.id
       LEFT JOIN overdue od ON od.plan_id  = pp.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Debtors list — students with a positive outstanding balance
router.get('/debtors', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id, class_id } = req.query;
  const conditions = ['pp.school_id = $1'];
  const params = [school_id];
  if (term_id)  { params.push(term_id);  conditions.push(`pp.term_id  = $${params.length}`); }
  if (class_id) { params.push(class_id); conditions.push(`s.class_id  = $${params.length}`); }
  try {
    const result = await pool.query(
      `SELECT pp.id AS plan_id, pp.plan_type, pp.total_amount,
              s.id AS student_id, s.name AS student_name, s.parent_phone,
              c.name AS class_name, t.name AS term_name,
              COALESCE(SUM(p.amount), 0)                                             AS total_paid,
              pp.total_amount - COALESCE(SUM(p.amount), 0)                          AS balance,
              COALESCE(cf_agg.carry_forward_total, 0)                               AS carry_forward,
              pp.total_amount - COALESCE(SUM(p.amount), 0)
                + COALESCE(cf_agg.carry_forward_total, 0)                           AS effective_balance,
              GREATEST(0,
                COALESCE((SELECT SUM(ps.amount_due) FROM payment_schedules ps
                          WHERE ps.plan_id = pp.id AND ps.due_date < CURRENT_DATE), 0)
                - COALESCE(SUM(p.amount), 0)
              )                                                                      AS overdue_amount
       FROM payment_plans pp
       JOIN students s      ON s.id = pp.student_id
       LEFT JOIN classes c  ON c.id = s.class_id
       JOIN terms t         ON t.id = pp.term_id
       LEFT JOIN payments p ON p.plan_id = pp.id
       LEFT JOIN (
         SELECT student_id, to_term_id, SUM(amount) AS carry_forward_total
         FROM fee_carry_forwards WHERE school_id = $1
         GROUP BY student_id, to_term_id
       ) cf_agg ON cf_agg.student_id = pp.student_id AND cf_agg.to_term_id = pp.term_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY pp.id, s.id, s.name, s.parent_phone, c.name, t.name, cf_agg.carry_forward_total
       HAVING pp.total_amount - COALESCE(SUM(p.amount), 0)
              + COALESCE(cf_agg.carry_forward_total, 0) > 0
       ORDER BY effective_balance DESC, s.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Balance Carry Forward ────────────────────────────────────────────────────

// List carry-forwards for a student
router.get('/carry-forward/:student_id', requirePrivilege('finance:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT cf.*, s.name AS student_name,
              ft.name AS from_term_name, tt.name AS to_term_name
       FROM fee_carry_forwards cf
       JOIN students s        ON s.id  = cf.student_id
       LEFT JOIN terms ft     ON ft.id = cf.from_term_id
       LEFT JOIN terms tt     ON tt.id = cf.to_term_id
       WHERE cf.school_id = $1 AND cf.student_id = $2
       ORDER BY cf.created_at DESC`,
      [school_id, req.params.student_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a carry-forward: computes balance from from_term plan and records it against to_term
router.post('/carry-forward', requirePrivilege('finance:write'), async (req, res) => {
  const { student_id, from_term_id, to_term_id, notes } = req.body;
  const { school_id, id: created_by } = req.user;

  if (!student_id || !from_term_id || !to_term_id) {
    return res.status(400).json({ error: 'student_id, from_term_id, and to_term_id required' });
  }
  if (from_term_id === to_term_id) {
    return res.status(400).json({ error: 'Source and destination terms must be different' });
  }

  try {
    const studentRes = await pool.query(
      'SELECT id, name FROM students WHERE id = $1 AND school_id = $2',
      [student_id, school_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });

    const planRes = await pool.query(
      `SELECT pp.id, pp.total_amount, COALESCE(SUM(p.amount), 0) AS total_paid
       FROM payment_plans pp
       LEFT JOIN payments p ON p.plan_id = pp.id
       WHERE pp.school_id = $1 AND pp.student_id = $2 AND pp.term_id = $3
       GROUP BY pp.id, pp.total_amount`,
      [school_id, student_id, from_term_id]
    );
    if (!planRes.rows.length) {
      return res.status(404).json({ error: 'No payment plan found for this student in the source term' });
    }

    const balance = Math.round(
      (parseFloat(planRes.rows[0].total_amount) - parseFloat(planRes.rows[0].total_paid)) * 100
    ) / 100;

    if (Math.abs(balance) < 0.01) {
      return res.status(400).json({ error: 'Balance is zero — nothing to carry forward' });
    }

    const toTermRes = await pool.query(
      'SELECT id, name FROM terms WHERE id = $1 AND school_id = $2',
      [to_term_id, school_id]
    );
    if (!toTermRes.rows.length) return res.status(404).json({ error: 'Destination term not found' });

    const result = await pool.query(
      `INSERT INTO fee_carry_forwards
         (school_id, student_id, from_term_id, to_term_id, amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [school_id, student_id, from_term_id, to_term_id, balance, notes || null, created_by]
    );

    audit(req, 'CREATE', 'carry_forward', result.rows[0].id,
      { student_id, from_term_id, to_term_id, amount: balance });

    res.status(201).json({
      ...result.rows[0],
      student_name:   studentRes.rows[0].name,
      to_term_name:   toTermRes.rows[0].name,
      type:           balance > 0 ? 'arrears' : 'credit',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Balance already carried forward from this term for this student' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a carry-forward (owner only — hard to reverse accidental entries)
router.delete('/carry-forward/:id', requireRole('owner'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      'DELETE FROM fee_carry_forwards WHERE id = $1 AND school_id = $2 RETURNING id',
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
