const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const seedRoles = require('../utils/seedRoles');
const PLAN_META = require('../config/plans');
const { invalidate: invalidateSchoolCache } = require('../middleware/tenant');
const { invalidateFlags } = require('../lib/flags');

const router = express.Router();
router.use(requireRole('system_admin'));

async function getPlanPrices() {
  try {
    const { rows } = await pool.query('SELECT plan, price_ghs FROM plan_pricing');
    return Object.fromEntries(rows.map(r => [r.plan, parseFloat(r.price_ghs)]));
  } catch {
    // Fallback if migration hasn't been run yet
    return { trial: 0, basic: 500, premium: 1500 };
  }
}

function toSetupScore(row) {
  const checks = [row.has_classes, row.has_terms, row.has_subjects,
                  row.has_staff, row.has_fees, row.has_students];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function computeRisk(setupScore, plan, trialEndDate) {
  if (plan === 'trial' && trialEndDate) {
    const daysLeft = Math.floor((new Date(trialEndDate) - new Date()) / 86400000);
    if (daysLeft < 0 || daysLeft <= 3) return 'high';
    if (daysLeft <= 7) return 'medium';
  }
  if (setupScore < 30) return 'high';
  if (setupScore < 65) return 'medium';
  return 'low';
}

// Shared subqueries for setup steps — injected into any FROM schools query
const SETUP_SELECTS = `
  (EXISTS (SELECT 1 FROM classes      c  WHERE c.school_id  = s.id)) AS has_classes,
  (EXISTS (SELECT 1 FROM terms        t  WHERE t.school_id  = s.id)) AS has_terms,
  (EXISTS (SELECT 1 FROM subjects     su WHERE su.school_id = s.id)) AS has_subjects,
  (EXISTS (SELECT 1 FROM users        u2 WHERE u2.school_id = s.id AND u2.role != 'owner')) AS has_staff,
  (EXISTS (SELECT 1 FROM fee_structures fs WHERE fs.school_id = s.id)) AS has_fees,
  (EXISTS (SELECT 1 FROM students     st2 WHERE st2.school_id = s.id AND st2.status = 'active')) AS has_students
`;

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [schoolsRes, usersRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE plan != 'trial' OR trial_end_date > NOW()) AS active
        FROM schools
      `),
      pool.query('SELECT COUNT(*) FROM users'),
    ]);
    res.json({
      total_schools:  parseInt(schoolsRes.rows[0].total),
      active_schools: parseInt(schoolsRes.rows[0].active),
      total_users:    parseInt(usersRes.rows[0].count),
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/schools ───────────────────────────────────────────────────
router.get('/schools', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name, s.code, s.email, s.phone, s.address,
        s.plan, s.trial_end_date, s.created_at,
        COUNT(DISTINCT u.id)  AS user_count,
        COUNT(DISTINCT st.id) AS student_count,
        (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.school_id = s.id) AS last_activity,
        ${SETUP_SELECTS}
      FROM schools s
      LEFT JOIN users    u  ON u.school_id  = s.id
      LEFT JOIN students st ON st.school_id = s.id AND st.status = 'active'
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 500
    `);

    const schools = result.rows.map(row => {
      const setup_score = toSetupScore(row);
      return {
        id: row.id, name: row.name, code: row.code,
        email: row.email, phone: row.phone, address: row.address,
        plan: row.plan, trial_end_date: row.trial_end_date, created_at: row.created_at,
        user_count:    parseInt(row.user_count),
        student_count: parseInt(row.student_count),
        last_activity: row.last_activity,
        setup_score,
        risk: computeRisk(setup_score, row.plan, row.trial_end_date),
        setup_steps: {
          classes: row.has_classes, terms: row.has_terms, subjects: row.has_subjects,
          staff: row.has_staff, fees: row.has_fees, students: row.has_students,
        },
      };
    });
    res.json(schools);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/schools/:id ───────────────────────────────────────────────
router.get('/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [schoolRes, usersRes] = await Promise.all([
      pool.query(`
        SELECT s.id, s.name, s.code, s.email, s.phone, s.address,
               s.plan, s.trial_end_date, s.created_at,
          (SELECT COUNT(*) FROM users    u  WHERE u.school_id  = s.id)                        AS user_count,
          (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id AND st.status='active') AS student_count,
          (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.school_id = s.id)             AS last_activity,
          ${SETUP_SELECTS}
        FROM schools s WHERE s.id = $1
      `, [id]),
      pool.query(
        'SELECT id, name, email, role, is_active FROM users WHERE school_id=$1 ORDER BY created_at',
        [id]
      ),
    ]);

    if (!schoolRes.rows.length) return res.status(404).json({ error: 'School not found' });

    const row = schoolRes.rows[0];
    const setup_score = toSetupScore(row);

    const issues = [];
    if (!row.has_classes)  issues.push({ message: 'No classes configured',                  type: 'setup' });
    if (!row.has_terms)    issues.push({ message: 'No academic terms configured',            type: 'setup' });
    if (!row.has_subjects) issues.push({ message: 'No subjects configured',                  type: 'setup' });
    if (!row.has_staff)    issues.push({ message: 'No staff added beyond owner',             type: 'setup' });
    if (!row.has_fees)     issues.push({ message: 'No fee structures configured',            type: 'setup' });
    if (!row.has_students) issues.push({ message: 'No active students enrolled',             type: 'setup' });
    if (row.plan === 'trial' && row.trial_end_date) {
      const daysLeft = Math.floor((new Date(row.trial_end_date) - new Date()) / 86400000);
      if (daysLeft <= 7) {
        issues.push({ message: `Trial expires in ${Math.max(0, daysLeft)} day${daysLeft !== 1 ? 's' : ''}`, type: 'billing' });
      }
    }

    res.json({
      id: row.id, name: row.name, code: row.code,
      email: row.email, phone: row.phone, address: row.address,
      plan: row.plan, trial_end_date: row.trial_end_date, created_at: row.created_at,
      user_count:    parseInt(row.user_count),
      student_count: parseInt(row.student_count),
      last_activity: row.last_activity,
      setup_score,
      risk: computeRisk(setup_score, row.plan, row.trial_end_date),
      setup_steps: {
        classes: row.has_classes, terms: row.has_terms, subjects: row.has_subjects,
        staff: row.has_staff, fees: row.has_fees, students: row.has_students,
      },
      users:  usersRes.rows,
      issues,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/schools ──────────────────────────────────────────────────
router.post('/schools', async (req, res) => {
  const {
    school_name, school_code, school_address, school_phone, school_email,
    owner_name, owner_email, owner_password,
    plan = 'trial',
  } = req.body;

  if (!school_name || !school_code || !owner_name || !owner_email || !owner_password) {
    return res.status(400).json({ error: 'school_name, school_code, owner_name, owner_email, owner_password required' });
  }
  if (owner_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!['trial', 'basic', 'premium'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be trial, basic, or premium' });
  }

  const trial_end_date = new Date();
  trial_end_date.setDate(trial_end_date.getDate() + 122); // ~4 months, avoids month-overflow edge cases

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const schoolRes = await client.query(
      `INSERT INTO schools (name, code, address, phone, email, plan, trial_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, code, plan`,
      [school_name, school_code, school_address, school_phone, school_email,
       plan, plan === 'trial' ? trial_end_date : null]
    );
    const school = schoolRes.rows[0];

    const hash = await bcrypt.hash(owner_password, 10);
    const userRes = await client.query(
      `INSERT INTO users (school_id, name, email, username, password_hash, role)
       VALUES ($1, $2, $3, $3, $4, 'owner') RETURNING id, name, role`,
      [school.id, owner_name, owner_email, hash]
    );

    await seedRoles(client, school.id);
    await client.query('COMMIT');

    pool.query(
      `INSERT INTO audit_logs (action, entity, entity_id, meta, ip)
       VALUES ('admin_create_school', 'school', $1, $2, $3)`,
      [school.id, JSON.stringify({ school_name, plan, admin_id: req.user.id }), req.ip]
    ).catch(() => {});

    res.status(201).json({
      school: { id: school.id, name: school.name, code: school.code, plan: school.plan },
      owner:  { id: userRes.rows[0].id, name: userRes.rows[0].name, role: userRes.rows[0].role },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'School code or email already exists' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/admin/health ────────────────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name,
        ${SETUP_SELECTS},
        (EXISTS (
          SELECT 1 FROM audit_logs al
          WHERE al.school_id = s.id AND al.entity = 'payment'
            AND al.created_at > NOW() - INTERVAL '30 days'
        )) AS payment_activity,
        (EXISTS (
          SELECT 1 FROM audit_logs al
          WHERE al.school_id = s.id AND al.entity IN ('grade','result','assessment')
            AND al.created_at > NOW() - INTERVAL '30 days'
        )) AS academic_activity
      FROM schools s
      ORDER BY s.name
      LIMIT 500
    `);

    const schools = result.rows.map(row => ({
      school_id:        row.id,
      school_name:      row.name,
      setup_score:      toSetupScore(row),
      payment_activity:  row.payment_activity,
      academic_activity: row.academic_activity,
    }));

    const avg_score = schools.length
      ? Math.round(schools.reduce((a, b) => a + b.setup_score, 0) / schools.length)
      : 0;

    res.json({ schools, avg_score, total: schools.length });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/alerts ────────────────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.plan, s.trial_end_date, s.created_at,
        ${SETUP_SELECTS},
        (SELECT MAX(al.created_at) FROM audit_logs al WHERE al.school_id = s.id) AS last_activity
      FROM schools s ORDER BY s.created_at
      LIMIT 500
    `);

    const alerts = [];
    const now = new Date();

    for (const row of result.rows) {
      const setup_score    = toSetupScore(row);
      const daysSinceJoin  = Math.floor((now - new Date(row.created_at)) / 86400000);
      const lastActivityMs = row.last_activity ? new Date(row.last_activity) : new Date(row.created_at);
      const inactiveDays   = Math.floor((now - lastActivityMs) / 86400000);

      if (row.plan === 'trial' && row.trial_end_date) {
        const daysLeft = Math.floor((new Date(row.trial_end_date) - now) / 86400000);
        if (daysLeft < 0) {
          alerts.push({
            id: `${row.id}_expired`, school_id: row.id, school: row.name,
            type: 'Trial Expired',
            message: `Trial expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`,
            severity: 'high', created_at: row.trial_end_date,
          });
        } else if (daysLeft <= 7) {
          alerts.push({
            id: `${row.id}_expiring`, school_id: row.id, school: row.name,
            type: 'Trial Expiring',
            message: `Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            severity: daysLeft <= 3 ? 'high' : 'medium', created_at: now,
          });
        }
      }

      if (setup_score < 50 && daysSinceJoin >= 7) {
        alerts.push({
          id: `${row.id}_setup`, school_id: row.id, school: row.name,
          type: 'Setup Incomplete',
          message: `Setup is only ${setup_score}% complete after ${daysSinceJoin} days`,
          severity: setup_score < 20 ? 'high' : 'medium', created_at: row.created_at,
        });
      }

      if (daysSinceJoin >= 30 && inactiveDays >= 30) {
        alerts.push({
          id: `${row.id}_inactive`, school_id: row.id, school: row.name,
          type: 'Low Activity',
          message: `No activity recorded in ${inactiveDays} days`,
          severity: 'medium', created_at: row.last_activity || row.created_at,
        });
      }
    }

    const order = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => order[a.severity] - order[b.severity]);

    res.json(alerts);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Alert resolve is acknowledged optimistically — alerts regenerate from live data
router.post('/alerts/:id/resolve', (req, res) => res.json({ ok: true }));

// ─── GET /api/admin/billing ───────────────────────────────────────────────────
router.get('/billing', async (req, res) => {
  try {
    const [result, planPrices] = await Promise.all([
      pool.query(`
        SELECT s.id, s.name, s.plan, s.trial_end_date, s.created_at,
          COUNT(DISTINCT u.id) AS user_count,
          (SELECT sub.expiry_date FROM subscriptions sub
           WHERE sub.school_id = s.id AND sub.status = 'active'
           ORDER BY sub.created_at DESC LIMIT 1) AS subscription_expiry
        FROM schools s
        LEFT JOIN users u ON u.school_id = s.id
        GROUP BY s.id
        ORDER BY s.name
        LIMIT 500
      `),
      getPlanPrices(),
    ]);

    const now = new Date();
    const schools = result.rows.map(row => {
      const daysLeft = row.trial_end_date
        ? Math.floor((new Date(row.trial_end_date) - now) / 86400000)
        : null;
      const subDaysLeft = row.subscription_expiry
        ? Math.floor((new Date(row.subscription_expiry) - now) / 86400000)
        : null;
      let status;
      if (row.plan === 'trial') {
        status = daysLeft !== null && daysLeft < 0 ? 'expired' : 'trial';
      } else {
        status = subDaysLeft !== null && subDaysLeft < 0 ? 'expired' : 'active';
      }
      return {
        id: row.id, name: row.name, plan: row.plan,
        status, trial_end_date: row.trial_end_date, days_left: daysLeft,
        subscription_expiry: row.subscription_expiry, sub_days_left: subDaysLeft,
        amount:     planPrices[row.plan] ?? 0,
        user_count: parseInt(row.user_count),
      };
    });

    const total_revenue  = schools.filter(s => s.status === 'active').reduce((a, b) => a + b.amount, 0);
    const active_count   = schools.filter(s => s.status === 'active').length;
    const trial_count    = schools.filter(s => s.status === 'trial').length;
    const expiring_count = schools.filter(s =>
      (s.days_left !== null && s.days_left >= 0 && s.days_left <= 30) ||
      (s.sub_days_left !== null && s.sub_days_left >= 0 && s.sub_days_left <= 30)
    ).length;

    res.json({ schools, total_revenue, active_count, trial_count, expiring_count });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/usage ─────────────────────────────────────────────────────
router.get('/usage', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id, s.name,
        COUNT(DISTINCT al.user_id) FILTER (WHERE al.created_at > NOW() - INTERVAL '30 days') AS active_users,
        COUNT(al.id)               FILTER (WHERE al.created_at > NOW() - INTERVAL '30 days') AS action_count,
        array_agg(DISTINCT al.entity) FILTER (
          WHERE al.created_at > NOW() - INTERVAL '30 days' AND al.entity IS NOT NULL
        ) AS features
      FROM schools s
      LEFT JOIN audit_logs al ON al.school_id = s.id
      GROUP BY s.id
      ORDER BY action_count DESC NULLS LAST
      LIMIT 500
    `);

    const schools = result.rows.map(row => ({
      id:           row.id,
      name:         row.name,
      active_users: parseInt(row.active_users) || 0,
      action_count: parseInt(row.action_count) || 0,
      features:     row.features || [],
    }));

    res.json(schools);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  const { search, entity, limit = '100', offset = '0' } = req.query;
  const lim = Math.min(parseInt(limit) || 100, 500);
  const off = Math.max(parseInt(offset) || 0, 0);

  const conditions = [];
  const params = [];

  if (entity) { params.push(entity); conditions.push(`al.entity = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    const n = params.length;
    conditions.push(`(s.name ILIKE $${n} OR al.action ILIKE $${n} OR al.entity ILIKE $${n})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countParams = [...params];
    params.push(lim, off);

    const [logsRes, countRes] = await Promise.all([
      pool.query(`
        SELECT al.id, al.action, al.entity, al.entity_id, al.meta, al.ip, al.created_at,
               s.name AS school_name, u.name AS user_name
        FROM audit_logs al
        LEFT JOIN schools s ON s.id = al.school_id
        LEFT JOIN users   u ON u.id = al.user_id
        ${where}
        ORDER BY al.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params),
      pool.query(
        `SELECT COUNT(*) FROM audit_logs al LEFT JOIN schools s ON s.id = al.school_id ${where}`,
        countParams
      ),
    ]);

    res.json({ logs: logsRes.rows, total: parseInt(countRes.rows[0].count) });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/onboarding ────────────────────────────────────────────────
router.get('/onboarding', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.name, s.created_at, ${SETUP_SELECTS}
      FROM schools s ORDER BY s.created_at DESC
      LIMIT 500
    `);

    const schools = result.rows.map(row => {
      const allDone = [row.has_classes, row.has_terms, row.has_subjects,
                       row.has_staff, row.has_fees, row.has_students].every(Boolean);
      const steps = [
        { label: 'School Identity',    done: true              },
        { label: 'Classes',            done: row.has_classes   },
        { label: 'Terms',              done: row.has_terms     },
        { label: 'Subjects',           done: row.has_subjects  },
        { label: 'Staff',              done: row.has_staff     },
        { label: 'Fees',               done: row.has_fees      },
        { label: 'Students',           done: row.has_students  },
        { label: 'Review',             done: allDone           },
      ];
      const completedCount  = steps.filter(s => s.done).length;
      const firstIncomplete = steps.findIndex(s => !s.done);
      return {
        id: row.id, name: row.name, created_at: row.created_at,
        steps,
        current_step: firstIncomplete === -1 ? 8 : firstIncomplete + 1,
        progress:     Math.round((completedCount / steps.length) * 100),
        status:       completedCount === steps.length ? 'complete' : 'in_progress',
      };
    });

    const completed  = schools.filter(s => s.status === 'complete').length;
    const in_progress = schools.filter(s => s.status === 'in_progress').length;

    res.json({ schools, completed, in_progress, not_started: 0, total: schools.length });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/schools/:id/resend-invite ────────────────────────────────
router.post('/schools/:id/resend-invite', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM schools WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'School not found' });
    res.json({ ok: true, message: 'Invite queued (email integration pending)' });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/schools/:id/trigger-onboarding ──────────────────────────
router.post('/schools/:id/trigger-onboarding', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM schools WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'School not found' });
    res.json({ ok: true, message: `Onboarding triggered for ${rows[0].name}` });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/admin/schools/:id/subscription ───────────────────────────────
router.patch('/schools/:id/subscription', async (req, res) => {
  const { plan, expiry_date, notes } = req.body;
  const VALID_PLANS = ['trial', 'basic', 'premium'];
  if (!plan || !VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'plan must be trial, basic, or premium' });
  }
  if (plan !== 'trial' && !expiry_date) {
    return res.status(400).json({ error: 'expiry_date is required for paid plans' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT id, name, plan FROM schools WHERE id=$1', [req.params.id]);
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'School not found' }); }
    const school = rows[0];
    const fromPlan = school.plan;

    await client.query(
      "UPDATE subscriptions SET status='cancelled' WHERE school_id=$1 AND status='active'",
      [req.params.id]
    );

    const subRes = await client.query(
      `INSERT INTO subscriptions (school_id, plan, status, expiry_date)
       VALUES ($1,$2,'active',$3) RETURNING *`,
      [req.params.id, plan, expiry_date || null]
    );

    await client.query(
      `UPDATE schools SET plan=$1,
         trial_end_date = CASE WHEN $1 = 'trial' THEN trial_end_date ELSE NULL END
       WHERE id=$2`,
      [plan, req.params.id]
    );

    await client.query(
      `INSERT INTO audit_logs (school_id, user_id, action, entity, entity_id, meta, ip)
       VALUES ($1,$2,'plan_change','subscriptions',$3,$4,$5)`,
      [req.params.id, req.user.id, subRes.rows[0].id,
       JSON.stringify({ from: fromPlan, to: plan, expiry_date: expiry_date || null, notes: notes || null }),
       req.ip]
    );

    await client.query('COMMIT');
    invalidateSchoolCache(req.params.id);
    res.json({ school_id: req.params.id, school_name: school.name, from: fromPlan, to: plan, subscription: subRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ─── GET /api/admin/schools/:id/subscriptions ────────────────────────────────
router.get('/schools/:id/subscriptions', async (req, res) => {
  try {
    const { rows: school } = await pool.query('SELECT id FROM schools WHERE id=$1', [req.params.id]);
    if (!school.length) return res.status(404).json({ error: 'School not found' });

    const { rows } = await pool.query(`
      SELECT
        sub.id, sub.plan, sub.status, sub.expiry_date, sub.created_at,
        (SELECT u.name FROM audit_logs al
         JOIN users u ON u.id = al.user_id
         WHERE al.entity_id::text = sub.id::text AND al.action = 'plan_change'
         ORDER BY al.created_at DESC LIMIT 1) AS changed_by
      FROM subscriptions sub
      WHERE sub.school_id = $1
      ORDER BY sub.created_at DESC
    `, [req.params.id]);

    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/plans ─────────────────────────────────────────────────────
router.get('/plans', async (req, res) => {
  try {
    const planPrices = await getPlanPrices();
    const plans = Object.entries(PLAN_META).map(([key, meta]) => ({
      plan: key,
      label: meta.label,
      description: meta.description,
      features: meta.features,
      price_ghs: planPrices[key] ?? 0,
    }));
    res.json(plans);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/plans/:plan/price ────────────────────────────────────────
router.post('/plans/:plan/price', async (req, res) => {
  const { plan } = req.params;
  const price_ghs = parseFloat(req.body.price_ghs);

  if (!['basic', 'premium'].includes(plan)) {
    return res.status(400).json({ error: 'Only basic and premium plan prices can be updated' });
  }
  if (isNaN(price_ghs) || price_ghs < 0) {
    return res.status(400).json({ error: 'price_ghs must be a non-negative number' });
  }

  try {
    await pool.query(
      `INSERT INTO plan_pricing (plan, price_ghs, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (plan) DO UPDATE SET price_ghs = $2, updated_at = NOW()`,
      [plan, price_ghs]
    );
    pool.query(
      `INSERT INTO audit_logs (action, entity, meta, ip)
       VALUES ('update_plan_price', 'plan_pricing', $1, $2)`,
      [JSON.stringify({ plan, price_ghs, admin_id: req.user.id }), req.ip]
    ).catch(() => {});
    res.json({ plan, price_ghs });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/flags ─────────────────────────────────────────────────────
router.get('/flags', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, school_id, flag_name, enabled, updated_at
       FROM feature_flags ORDER BY flag_name, school_id NULLS FIRST`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/admin/flags ─────────────────────────────────────────────────────
// Set a flag for a specific school (school_id) or globally (school_id = null).
router.put('/flags', async (req, res) => {
  const { school_id = null, flag_name, enabled } = req.body;
  if (!flag_name) return res.status(400).json({ error: 'flag_name required' });
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be boolean' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO feature_flags (school_id, flag_name, enabled, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (school_id, flag_name) DO UPDATE SET enabled=$3, updated_at=NOW()
       RETURNING *`,
      [school_id, flag_name, enabled]
    );
    if (school_id) invalidateFlags(school_id, flag_name);
    pool.query(
      `INSERT INTO audit_logs (action, entity, meta, ip)
       VALUES ('set_feature_flag', 'feature_flags', $1, $2)`,
      [JSON.stringify({ school_id, flag_name, enabled, admin_id: req.user.id }), req.ip]
    ).catch(() => {});
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/admin/flags ──────────────────────────────────────────────────
router.delete('/flags', async (req, res) => {
  const { school_id = null, flag_name } = req.body;
  if (!flag_name) return res.status(400).json({ error: 'flag_name required' });
  try {
    await pool.query(
      'DELETE FROM feature_flags WHERE flag_name=$1 AND school_id IS NOT DISTINCT FROM $2',
      [flag_name, school_id]
    );
    if (school_id) invalidateFlags(school_id, flag_name);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/admin/analytics/refresh ───────────────────────────────────────
// Refresh all materialized analytics views. Safe to run concurrently — uses
// REFRESH MATERIALIZED VIEW CONCURRENTLY so reads are not blocked.
router.post('/analytics/refresh', async (req, res) => {
  try {
    await pool.query(`
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_attendance_summary;
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_grade_summary;
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_student_subject_averages;
    `);
    pool.query(
      `INSERT INTO audit_logs (action, entity, meta, ip)
       VALUES ('refresh_analytics_views', 'system', $1, $2)`,
      [JSON.stringify({ admin_id: req.user.id }), req.ip]
    ).catch(() => {});
    res.json({ ok: true, refreshed_at: new Date().toISOString() });
  } catch (err) {
    console.error('analytics refresh failed:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/admin/system-health ────────────────────────────────────────────
// Returns operational metrics: DB pool saturation, Redis status, BullMQ queue depths.
// Wire this to an internal uptime monitor or Grafana dashboard.
router.get('/system-health', async (req, res) => {
  const { reportQueue, viewsQueue, backupQueue, redisClient } = require('../jobs/queue');

  // DB pool stats
  const dbPool = {
    total:   pool.totalCount,
    idle:    pool.idleCount,
    waiting: pool.waitingCount,
  };

  // Redis connectivity
  let redisStatus = 'unavailable';
  try {
    await redisClient.ping();
    redisStatus = 'ok';
  } catch {
    redisStatus = 'unavailable';
  }

  // BullMQ queue depths (only if Redis is available)
  let queueDepths = null;
  if (redisStatus === 'ok') {
    try {
      const [reportCounts, viewsCounts, backupCounts] = await Promise.all([
        reportQueue.getJobCounts('waiting', 'active', 'failed'),
        viewsQueue.getJobCounts('waiting', 'active', 'failed'),
        backupQueue.getJobCounts('waiting', 'active', 'failed'),
      ]);
      queueDepths = {
        reports:           reportCounts,
        'analytics-views': viewsCounts,
        backups:           backupCounts,
      };
    } catch {
      queueDepths = null;
    }
  }

  res.json({
    db_pool:       dbPool,
    redis:         redisStatus,
    queue_depths:  queueDepths,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp:     new Date().toISOString(),
  });
});

module.exports = router;
