/**
 * Tenant Isolation Test Suite
 *
 * Critical invariant: a JWT for School A must never return records belonging to School B.
 * One missing WHERE school_id = $1 in any route is a GDPR/trust violation.
 *
 * Setup: seeds two schools with overlapping data (same names, same dates).
 * Asserts: every read endpoint called with School A credentials returns zero School B records.
 *
 * Prerequisites:
 *   - DATABASE_URL env var pointing to a test or dev PostgreSQL database
 *   - JWT_SECRET env var set
 *   - Database already migrated (run migrations before this test suite)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const request = require('supertest');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const app = require('../src/index');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Seed state ────────────────────────────────────────────────────────────────
let schoolA, schoolB, userA, userB, tokenA;
let classA, termA, studentA1, studentA2;
let classB, termB, studentB1;

// ── Helpers ───────────────────────────────────────────────────────────────────
function signToken(user, school) {
  return jwt.sign(
    {
      id: user.id,
      school_id: school.id,
      role: 'owner',
      privileges: [
        'finance:read','finance:write','academic:read','academic:write',
        'attendance:write','reports:read','users:manage','classes:manage',
        'timetable:manage','announcements:post','store:manage',
        'feeding:write','roles:manage','calendar:manage',
      ],
      token_version: 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function q(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
beforeAll(async () => {
  // Ensure uuid-ossp extension exists (needed for uuid_generate_v4())
  await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // School A
  [schoolA] = await q(`
    INSERT INTO schools (name, code, plan, trial_end_date)
    VALUES ('Test School Alpha', 'TST-A-ISOLATION', 'premium', NOW() + INTERVAL '1 year')
    RETURNING *
  `);

  // School B — same name prefix to ensure ILIKE leaks would surface
  [schoolB] = await q(`
    INSERT INTO schools (name, code, plan, trial_end_date)
    VALUES ('Test School Beta', 'TST-B-ISOLATION', 'premium', NOW() + INTERVAL '1 year')
    RETURNING *
  `);

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('TestPass123!', 10);

  // Owner for school A
  [userA] = await q(`
    INSERT INTO users (school_id, name, email, username, password_hash, role, token_version)
    VALUES ($1, 'Alpha Owner', 'alpha-owner@test.invalid', 'alpha-owner@test.invalid', $2, 'owner', 0)
    RETURNING *
  `, [schoolA.id, hash]);

  // Owner for school B
  [userB] = await q(`
    INSERT INTO users (school_id, name, email, username, password_hash, role, token_version)
    VALUES ($1, 'Beta Owner', 'beta-owner@test.invalid', 'beta-owner@test.invalid', $2, 'owner', 0)
    RETURNING *
  `, [schoolB.id, hash]);

  tokenA = signToken(userA, schoolA);

  // Class + term for each school
  [classA] = await q(`
    INSERT INTO classes (school_id, name, order_num) VALUES ($1, 'Class One', 1) RETURNING *
  `, [schoolA.id]);
  [classB] = await q(`
    INSERT INTO classes (school_id, name, order_num) VALUES ($1, 'Class One', 1) RETURNING *
  `, [schoolB.id]);

  [termA] = await q(`
    INSERT INTO terms (school_id, name, start_date, end_date, academic_year)
    VALUES ($1, 'Term 1', '2026-01-01', '2026-04-30', '2026') RETURNING *
  `, [schoolA.id]);
  [termB] = await q(`
    INSERT INTO terms (school_id, name, start_date, end_date, academic_year)
    VALUES ($1, 'Term 1', '2026-01-01', '2026-04-30', '2026') RETURNING *
  `, [schoolB.id]);

  // Students — same name to surface ILIKE leaks
  [studentA1] = await q(`
    INSERT INTO students (school_id, class_id, name, student_code, status)
    VALUES ($1, $2, 'Kwame Mensah', 'STU-A1', 'active') RETURNING *
  `, [schoolA.id, classA.id]);
  [studentA2] = await q(`
    INSERT INTO students (school_id, class_id, name, student_code, status)
    VALUES ($1, $2, 'Ama Asante', 'STU-A2', 'active') RETURNING *
  `, [schoolA.id, classA.id]);
  [studentB1] = await q(`
    INSERT INTO students (school_id, class_id, name, student_code, status)
    VALUES ($1, $2, 'Kwame Mensah', 'STU-B1', 'active') RETURNING *
  `, [schoolB.id, classB.id]);

  // Attendance for both schools on same date
  await q(`
    INSERT INTO attendance (school_id, student_id, class_id, date, status, recorded_by)
    VALUES ($1, $2, $3, '2026-03-01', 'present', $4)
  `, [schoolA.id, studentA1.id, classA.id, userA.id]);
  await q(`
    INSERT INTO attendance (school_id, student_id, class_id, date, status, recorded_by)
    VALUES ($1, $2, $3, '2026-03-01', 'present', $4)
  `, [schoolB.id, studentB1.id, classB.id, userB.id]);

  // Payment plans + payments for both schools
  const [planA] = await q(`
    INSERT INTO payment_plans (school_id, student_id, term_id, plan_type, total_amount, start_date)
    VALUES ($1, $2, $3, '50_50', 500, '2026-01-01') RETURNING *
  `, [schoolA.id, studentA1.id, termA.id]);
  const [planB] = await q(`
    INSERT INTO payment_plans (school_id, student_id, term_id, plan_type, total_amount, start_date)
    VALUES ($1, $2, $3, '50_50', 500, '2026-01-01') RETURNING *
  `, [schoolB.id, studentB1.id, termB.id]);

  await q(`
    INSERT INTO payments (school_id, student_id, plan_id, amount, payment_date, recorded_by)
    VALUES ($1, $2, $3, 200, '2026-03-01', $4)
  `, [schoolA.id, studentA1.id, planA.id, userA.id]);
  await q(`
    INSERT INTO payments (school_id, student_id, plan_id, amount, payment_date, recorded_by)
    VALUES ($1, $2, $3, 200, '2026-03-01', $4)
  `, [schoolB.id, studentB1.id, planB.id, userB.id]);

  // Announcements for both schools
  await q(`
    INSERT INTO announcements (school_id, title, body, audience, posted_by)
    VALUES ($1, 'Alpha Announcement', 'For school A only', 'all', $2)
  `, [schoolA.id, userA.id]);
  await q(`
    INSERT INTO announcements (school_id, title, body, audience, posted_by)
    VALUES ($1, 'Beta Announcement', 'For school B only', 'all', $2)
  `, [schoolB.id, userB.id]);
});

afterAll(async () => {
  // Clean up all test data in reverse-dependency order
  const ids = [schoolA?.id, schoolB?.id].filter(Boolean);
  if (ids.length) {
    // Cascade deletes handle child tables because of ON DELETE CASCADE constraints
    await pool.query('DELETE FROM schools WHERE id = ANY($1)', [ids]);
  }
  await pool.end();
});

// ── Utility: assert no records from school B appear ───────────────────────────
function assertNoLeakInArray(arr, label) {
  if (!Array.isArray(arr)) return;
  for (const item of arr) {
    if (item.school_id) {
      expect(item.school_id).not.toBe(schoolB.id);
    }
    // Catch student_id leaks by checking known school B student IDs
    if (item.student_id) {
      expect(item.student_id).not.toBe(studentB1?.id);
    }
  }
}

function assertNoLeak(body, label) {
  if (Array.isArray(body)) {
    assertNoLeakInArray(body, label);
  } else if (body && typeof body === 'object') {
    // Handle paginated responses: { data: [...], total: N }
    // or { students: [...] }, { logs: [...] }, etc.
    for (const key of Object.keys(body)) {
      if (Array.isArray(body[key])) {
        assertNoLeakInArray(body[key], `${label}.${key}`);
      }
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Tenant Isolation — School A token must not return School B data', () => {
  const auth = () => ({ Authorization: `Bearer ${tokenA}` });

  test('GET /api/students — no school B students', async () => {
    const res = await request(app).get('/api/students').set(auth()).expect(200);
    assertNoLeak(res.body, 'students');
    const students = Array.isArray(res.body) ? res.body : (res.body.students || res.body.data || []);
    const ids = students.map(s => s.id);
    expect(ids).not.toContain(studentB1.id);
  });

  test('GET /api/students?search=Kwame — ILIKE does not return school B student', async () => {
    const res = await request(app).get('/api/students?search=Kwame').set(auth()).expect(200);
    const students = Array.isArray(res.body) ? res.body : (res.body.students || res.body.data || []);
    const ids = students.map(s => s.id);
    expect(ids).not.toContain(studentB1.id);
    // School A's Kwame Mensah should still appear
    expect(ids).toContain(studentA1.id);
  });

  test('GET /api/attendance — no school B attendance', async () => {
    const res = await request(app)
      .get(`/api/attendance?class_id=${classA.id}&date=2026-03-01`)
      .set(auth())
      .expect(200);
    assertNoLeak(res.body, 'attendance');
  });

  test('GET /api/payments — no school B payments', async () => {
    const res = await request(app).get('/api/payments').set(auth());
    if (res.status === 200) assertNoLeak(res.body, 'payments');
  });

  test('GET /api/users — no school B users', async () => {
    const res = await request(app).get('/api/users').set(auth()).expect(200);
    const users = Array.isArray(res.body) ? res.body : (res.body.users || res.body.data || []);
    const ids = users.map(u => u.id);
    expect(ids).not.toContain(userB.id);
  });

  test('GET /api/audit — no school B audit logs', async () => {
    const res = await request(app).get('/api/audit').set(auth()).expect(200);
    const logs = res.body.logs || res.body;
    if (Array.isArray(logs)) {
      for (const log of logs) {
        if (log.school_id) expect(log.school_id).not.toBe(schoolB.id);
      }
    }
  });

  test('GET /api/announcements — no school B announcements', async () => {
    const res = await request(app).get('/api/announcements').set(auth());
    if (res.status === 200) {
      const items = Array.isArray(res.body) ? res.body : (res.body.announcements || res.body.data || []);
      for (const item of items) {
        if (item.school_id) expect(item.school_id).not.toBe(schoolB.id);
      }
    }
  });

  test('GET /api/classes — no school B classes', async () => {
    const res = await request(app).get('/api/classes').set(auth()).expect(200);
    const items = Array.isArray(res.body) ? res.body : (res.body.data || []);
    const ids = items.map(c => c.id);
    expect(ids).not.toContain(classB.id);
  });

  test('GET /api/terms — no school B terms', async () => {
    const res = await request(app).get('/api/terms').set(auth()).expect(200);
    const items = Array.isArray(res.body) ? res.body : (res.body.data || []);
    const ids = items.map(t => t.id);
    expect(ids).not.toContain(termB.id);
  });

  test('Direct student access — school B student_id returns 403 or 404', async () => {
    const res = await request(app)
      .get(`/api/students/${studentB1.id}`)
      .set(auth());
    expect([403, 404]).toContain(res.status);
  });
});
