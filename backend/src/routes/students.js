const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');
const { SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();

// Detect whether the search_vector column exists (added by extend_schema14 migration).
// Falls back to ILIKE until the server is restarted after migration.
let searchVectorReady = null;
async function hasSearchVector() {
  if (searchVectorReady !== null) return searchVectorReady;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'students' AND column_name = 'search_vector' LIMIT 1`
    );
    searchVectorReady = rows.length > 0;
  } catch {
    searchVectorReady = false;
  }
  return searchVectorReady;
}

// List students — supports filters + optional server-side pagination
// Without ?page: returns plain array (backward compat, capped at 500)
// With ?page=N: returns { data, total, page, limit, pages }
// Teachers and class_teachers only see students in their assigned classes.
router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id, id: user_id, role } = req.user;
  const { class_id, status, family_id, search, page, limit: limitParam } = req.query;

  const conditions = ['s.school_id = $1'];
  const params = [school_id];

  // Scope to teacher's assigned classes
  if (SCOPED_ROLES.has(role)) {
    const { rows } = await pool.query(
      `SELECT DISTINCT class_id FROM teaching_assignments WHERE school_id=$1 AND teacher_id=$2`,
      [school_id, user_id]
    );
    const teacherClassIds = rows.map(r => r.class_id);
    if (!teacherClassIds.length) {
      // Teacher has no assignments — return empty
      return res.json(page !== undefined ? { data: [], total: 0, page: 1, limit: 50, pages: 0 } : []);
    }
    if (class_id) {
      // If a specific class is requested, make sure it's one the teacher is assigned to
      if (!teacherClassIds.includes(class_id)) {
        return res.status(403).json({ error: 'You are not assigned to this class' });
      }
      params.push(class_id);
      conditions.push(`s.class_id = $${params.length}`);
    } else {
      params.push(teacherClassIds);
      conditions.push(`s.class_id = ANY($${params.length})`);
    }
  } else {
    if (class_id) { params.push(class_id); conditions.push(`s.class_id = $${params.length}`); }
  }

  if (status)    { params.push(status);     conditions.push(`s.status = $${params.length}`); }
  if (family_id) { params.push(family_id);  conditions.push(`s.family_id = $${params.length}`); }
  if (!status)   conditions.push(`s.status = 'active'`);

  if (search) {
    if (await hasSearchVector()) {
      // Fast GIN-indexed prefix search. Strip tsquery-invalid characters first.
      const tokens = search.trim().split(/\s+/).filter(Boolean)
        .map(w => w.replace(/[^\wÀ-ɏ]/g, '').trim())
        .filter(w => w.length > 0);
      if (tokens.length > 0) {
        params.push(tokens.map(w => w + ':*').join(' & '));
        conditions.push(`s.search_vector @@ to_tsquery('simple', $${params.length})`);
      }
    } else {
      // Fallback: ILIKE (used before extend_schema14 migration runs)
      params.push(`%${search}%`);
      conditions.push(`(s.name ILIKE $${params.length} OR s.student_code ILIKE $${params.length})`);
    }
  }

  const where = conditions.join(' AND ');

  try {
    if (page !== undefined) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const lim     = Math.min(200, parseInt(limitParam) || 50);
      const offset  = (pageNum - 1) * lim;

      const [countRes, dataRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM students s WHERE ${where}`, params),
        pool.query(
          `SELECT s.*, c.name AS class_name, c.order_num AS class_order
           FROM students s
           LEFT JOIN classes c ON c.id = s.class_id
           WHERE ${where}
           ORDER BY c.order_num, s.name
           LIMIT ${lim} OFFSET ${offset}`,
          params
        ),
      ]);

      const total = parseInt(countRes.rows[0].count);
      return res.json({ data: dataRes.rows, total, page: pageNum, limit: lim, pages: Math.ceil(total / lim) });
    }

    // Non-paginated (backward compat — cap at 500 rows)
    const result = await pool.query(
      `SELECT s.*, c.name AS class_name, c.order_num AS class_order
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE ${where}
       ORDER BY c.order_num, s.name
       LIMIT 501`,
      params
    );
    const truncated = result.rows.length > 500;
    if (truncated) result.rows.pop();
    res.json(truncated ? { data: result.rows, truncated: true } : result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get siblings — all students sharing the same family_id
router.get('/family/:family_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT s.*, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1 AND s.family_id = $2
       ORDER BY s.name`,
      [school_id, req.params.family_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Academic history — full progression record for a student
router.get('/:id/history', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT
         o.id, o.outcome, o.notes, o.created_at,
         t.name AS term_name, t.start_date, t.end_date,
         fc.name AS from_class,
         tc.name AS to_class,
         u.name  AS recorded_by
       FROM student_academic_outcomes o
       JOIN terms   t  ON t.id  = o.term_id
       LEFT JOIN classes fc ON fc.id = o.from_class_id
       LEFT JOIN classes tc ON tc.id = o.to_class_id
       LEFT JOIN users   u  ON u.id  = o.recorded_by
       WHERE o.school_id=$1 AND o.student_id=$2
       ORDER BY t.start_date DESC`,
      [school_id, req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single student
router.get('/:id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `SELECT s.*, c.name AS class_name, c.order_num AS class_order
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create student
router.post('/', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const {
    family_id, student_code, name, dob, class_id, gender,
    parent_name, parent_phone, parent_email, address,
    parent2_name, parent2_phone,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    blood_group, allergies, medical_conditions,
    nationality, religion, admission_date,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let finalCode = student_code && student_code.trim() ? student_code.trim() : null;
    if (!finalCode) {
      // Atomically increment the school's counter and format: SCHOOLCODE/0001
      const schoolRes = await client.query(
        `UPDATE schools SET student_counter = student_counter + 1 WHERE id = $1 RETURNING student_counter, code`,
        [school_id]
      );
      const { student_counter, code } = schoolRes.rows[0];
      finalCode = `${code}/${String(student_counter).padStart(4, '0')}`;
    }

    const result = await client.query(
      `INSERT INTO students
         (school_id, family_id, student_code, name, dob, class_id, gender,
          parent_name, parent_phone, parent_email, address,
          parent2_name, parent2_phone,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          blood_group, allergies, medical_conditions,
          nationality, religion, admission_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        school_id, family_id || null, finalCode, name, dob || null,
        class_id || null, gender || null,
        parent_name || null, parent_phone || null, parent_email || null, address || null,
        parent2_name || null, parent2_phone || null,
        emergency_contact_name || null, emergency_contact_phone || null, emergency_contact_relation || null,
        blood_group || null, allergies || null, medical_conditions || null,
        nationality || null, religion || null, admission_date || null,
      ]
    );

    await client.query('COMMIT');
    audit(req, 'CREATE', 'student', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Student code already exists' });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update student details
router.put('/:id', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const {
    family_id, student_code, name, dob, gender, class_id, status,
    parent_name, parent_phone, parent_email, address,
    parent2_name, parent2_phone,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    blood_group, allergies, medical_conditions,
    nationality, religion, admission_date,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE students
       SET family_id=$1, student_code=$2, name=$3, dob=$4, gender=$5, class_id=$6, status=$7,
           parent_name=$8, parent_phone=$9, parent_email=$10, address=$11,
           parent2_name=$12, parent2_phone=$13,
           emergency_contact_name=$14, emergency_contact_phone=$15, emergency_contact_relation=$16,
           blood_group=$17, allergies=$18, medical_conditions=$19,
           nationality=$20, religion=$21, admission_date=$22
       WHERE id=$23 AND school_id=$24 RETURNING *`,
      [
        family_id || null, student_code || null, name, dob || null, gender || null,
        class_id || null, status || 'active',
        parent_name || null, parent_phone || null, parent_email || null, address || null,
        parent2_name || null, parent2_phone || null,
        emergency_contact_name || null, emergency_contact_phone || null, emergency_contact_relation || null,
        blood_group || null, allergies || null, medical_conditions || null,
        nationality || null, religion || null, admission_date || null,
        req.params.id, school_id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    audit(req, 'UPDATE', 'student', req.params.id, { name });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign student to a class
router.put('/:id/class', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id } = req.user;
  const { class_id } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id required' });
  try {
    const classCheck = await pool.query(
      'SELECT id FROM classes WHERE id = $1 AND school_id = $2',
      [class_id, school_id]
    );
    if (!classCheck.rows.length) return res.status(404).json({ error: 'Class not found' });

    const result = await pool.query(
      'UPDATE students SET class_id = $1 WHERE id = $2 AND school_id = $3 RETURNING *',
      [class_id, req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Academic outcome (promote / repeat / graduate / transfer) ─────────────────
//
// Step 1 — preview (omit action):
//   POST /api/students/:id/outcome
//   Body: { term_id }
//   Returns current class + next-level sections with their current sizes.
//
// Step 2 — commit:
//   POST /api/students/:id/outcome
//   Body: { term_id, action, target_class_id?, notes? }
//
//   action = 'promote'    — moves to target_class_id (required when multiple sections exist)
//   action = 'repeat'     — stays in current class; repeat_count++
//   action = 'graduate'   — final class completed; status → 'graduated'
//   action = 'transfer'   — leaving school; status → 'transferred'
//
router.post('/:id/outcome', requirePrivilege('academic:write'), async (req, res) => {
  const { school_id, id: recorded_by } = req.user;
  const { term_id, action, target_class_id, notes } = req.body;

  if (!term_id) return res.status(400).json({ error: 'term_id required' });

  const VALID_ACTIONS = ['promote', 'repeat', 'graduate', 'transfer'];

  try {
    // Load student + current class
    const studentRes = await pool.query(
      `SELECT s.id, s.name, s.status, s.class_id, s.repeat_count,
              c.order_num, c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [req.params.id, school_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const student = studentRes.rows[0];

    if (student.status !== 'active') {
      return res.status(400).json({ error: `Student is already ${student.status}` });
    }
    if (!student.class_id) {
      return res.status(400).json({ error: 'Student is not assigned to a class' });
    }

    // Verify term belongs to the school
    const termRes = await pool.query(
      'SELECT id FROM terms WHERE id=$1 AND school_id=$2',
      [term_id, school_id]
    );
    if (!termRes.rows.length) return res.status(404).json({ error: 'Term not found' });

    // Check if an outcome already exists for this term
    const existingRes = await pool.query(
      'SELECT id, outcome FROM student_academic_outcomes WHERE student_id=$1 AND term_id=$2',
      [student.id, term_id]
    );
    if (existingRes.rows.length) {
      return res.status(409).json({
        error: `Outcome already recorded for this term: ${existingRes.rows[0].outcome}`,
      });
    }

    // Find next-level sections (needed for promote preview and validation)
    const nextLevelRes = await pool.query(
      'SELECT MIN(order_num) AS next_order FROM classes WHERE school_id=$1 AND order_num > $2',
      [school_id, student.order_num]
    );
    const nextOrder = nextLevelRes.rows[0]?.next_order ?? null;

    const nextClassesRes = nextOrder != null
      ? await pool.query(
          `SELECT c.id, c.name, c.order_num,
                  COUNT(s2.id) AS student_count
           FROM classes c
           LEFT JOIN students s2 ON s2.class_id = c.id AND s2.status = 'active'
           WHERE c.school_id = $1 AND c.order_num = $2
           GROUP BY c.id ORDER BY c.name`,
          [school_id, nextOrder]
        )
      : { rows: [] };
    const nextClasses = nextClassesRes.rows;

    // ── PREVIEW (no action supplied) ───────────────────────────────────────────
    if (!action) {
      return res.json({
        student_id: student.id,
        student_name: student.name,
        current_class: student.class_name,
        repeat_count: student.repeat_count,
        next_classes: nextClasses,
        is_final_class: nextClasses.length === 0,
        available_actions: nextClasses.length > 0
          ? ['promote', 'repeat', 'transfer']
          : ['graduate', 'repeat', 'transfer'],
      });
    }

    // ── COMMIT ─────────────────────────────────────────────────────────────────
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    let newClassId    = student.class_id; // default: stays put
    let newStatus     = 'active';
    let newRepeatCount = student.repeat_count;
    let toClassName   = student.class_name;

    if (action === 'promote') {
      if (nextClasses.length === 0) {
        return res.status(400).json({ error: 'No next class exists. Use graduate instead.' });
      }
      if (!target_class_id) {
        return res.status(400).json({ error: 'target_class_id required for promote' });
      }
      const chosen = nextClasses.find(c => String(c.id) === String(target_class_id));
      if (!chosen) {
        return res.status(400).json({ error: 'target_class_id is not a valid next-level class' });
      }
      newClassId  = chosen.id;
      toClassName = chosen.name;
    }

    if (action === 'repeat') {
      newRepeatCount = student.repeat_count + 1;
      // class stays the same — student stays enrolled in the same class next term
    }

    if (action === 'graduate') {
      if (nextClasses.length > 0) {
        return res.status(400).json({ error: 'Student is not in the final class. Use promote instead.' });
      }
      newStatus = 'graduated';
    }

    if (action === 'transfer') {
      newStatus = 'transferred';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Record the outcome
      await client.query(
        `INSERT INTO student_academic_outcomes
           (school_id, student_id, term_id, outcome, from_class_id, to_class_id, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [school_id, student.id, term_id, action,
         student.class_id,
         action === 'promote' ? newClassId : null,
         notes || null,
         recorded_by]
      );

      // Update the student record
      await client.query(
        `UPDATE students
         SET class_id=$1, status=$2, repeat_count=$3
         WHERE id=$4 AND school_id=$5`,
        [newClassId, newStatus, newRepeatCount, student.id, school_id]
      );

      await client.query('COMMIT');

      audit(req, action.toUpperCase(), 'student_outcome', student.id,
        { from: student.class_name, to: toClassName, term_id, notes });

      res.json({
        success: true,
        student_id: student.id,
        student_name: student.name,
        outcome: action,
        from_class: student.class_name,
        to_class: toClassName,
        status: newStatus,
        repeat_count: newRepeatCount,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Outcome already recorded for this student and term' });
      }
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Bulk outcome — process a whole class at end of term ───────────────────────
//
// Body:
// {
//   class_id: "...",
//   term_id:  "...",
//   outcomes: [
//     { student_id, action, target_class_id?, notes? },
//     ...
//   ]
// }
//
// All outcomes are written in a single transaction (all-or-nothing).
// A student missing from the outcomes array is skipped (not an error).
//
router.post('/bulk-outcome', requireRole('owner'), async (req, res) => {
  const { school_id, id: recorded_by } = req.user;
  const { class_id, term_id, outcomes } = req.body;

  if (!class_id || !term_id || !Array.isArray(outcomes) || outcomes.length === 0) {
    return res.status(400).json({ error: 'class_id, term_id, and outcomes[] required' });
  }

  const VALID_ACTIONS = ['promote', 'repeat', 'graduate', 'transfer'];

  // Basic per-row validation before touching the DB
  for (const o of outcomes) {
    if (!o.student_id) return res.status(400).json({ error: 'Each outcome requires student_id' });
    if (!VALID_ACTIONS.includes(o.action)) {
      return res.status(400).json({ error: `Invalid action "${o.action}" for student ${o.student_id}` });
    }
    if (o.action === 'promote' && !o.target_class_id) {
      return res.status(400).json({ error: `target_class_id required for promote (student ${o.student_id})` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify class belongs to the school
    const classRes = await client.query(
      'SELECT id, name, order_num FROM classes WHERE id=$1 AND school_id=$2',
      [class_id, school_id]
    );
    if (!classRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }
    const cls = classRes.rows[0];

    // Verify term belongs to the school
    const termRes = await client.query(
      'SELECT id FROM terms WHERE id=$1 AND school_id=$2',
      [term_id, school_id]
    );
    if (!termRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Term not found' });
    }

    // Load all active students in the class
    const studentsRes = await client.query(
      `SELECT s.id, s.name, s.repeat_count FROM students s
       WHERE s.school_id=$1 AND s.class_id=$2 AND s.status='active'`,
      [school_id, class_id]
    );
    const studentMap = Object.fromEntries(studentsRes.rows.map(s => [s.id, s]));

    // Next-level sections (for promote validation)
    const nextLevelRes = await client.query(
      'SELECT MIN(order_num) AS next_order FROM classes WHERE school_id=$1 AND order_num > $2',
      [school_id, cls.order_num]
    );
    const nextOrder = nextLevelRes.rows[0]?.next_order ?? null;
    let validNextIds = new Set();
    if (nextOrder != null) {
      const nRes = await client.query(
        'SELECT id FROM classes WHERE school_id=$1 AND order_num=$2',
        [school_id, nextOrder]
      );
      validNextIds = new Set(nRes.rows.map(r => String(r.id)));
    }

    const results = [];

    for (const o of outcomes) {
      const student = studentMap[o.student_id];
      if (!student) {
        results.push({ student_id: o.student_id, skipped: true, reason: 'Not an active student of this class' });
        continue;
      }

      // Skip if outcome already recorded this term
      const dupCheck = await client.query(
        'SELECT id FROM student_academic_outcomes WHERE student_id=$1 AND term_id=$2',
        [o.student_id, term_id]
      );
      if (dupCheck.rows.length) {
        results.push({ student_id: o.student_id, skipped: true, reason: 'Outcome already recorded for this term' });
        continue;
      }

      // Determine new class and status
      let newClassId    = class_id;
      let newStatus     = 'active';
      let newRepeatCount = student.repeat_count;
      let toClassId     = null;

      if (o.action === 'promote') {
        if (!validNextIds.has(String(o.target_class_id))) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Invalid target_class_id for student ${o.student_id}`,
          });
        }
        newClassId = o.target_class_id;
        toClassId  = o.target_class_id;
      }
      if (o.action === 'repeat')   { newRepeatCount++; }
      if (o.action === 'graduate') { newStatus = 'graduated'; }
      if (o.action === 'transfer') { newStatus = 'transferred'; }

      await client.query(
        `INSERT INTO student_academic_outcomes
           (school_id, student_id, term_id, outcome, from_class_id, to_class_id, notes, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [school_id, o.student_id, term_id, o.action,
         class_id, toClassId, o.notes || null, recorded_by]
      );

      await client.query(
        `UPDATE students SET class_id=$1, status=$2, repeat_count=$3
         WHERE id=$4 AND school_id=$5`,
        [newClassId, newStatus, newRepeatCount, o.student_id, school_id]
      );

      results.push({ student_id: o.student_id, name: student.name, outcome: o.action, skipped: false });
    }

    await client.query('COMMIT');

    audit(req, 'BULK_OUTCOME', 'student_outcome', class_id,
      { term_id, class_name: cls.name, count: outcomes.length });

    res.json({
      success: true,
      processed: results.filter(r => !r.skipped).length,
      skipped:   results.filter(r => r.skipped).length,
      results,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Soft delete — sets status to inactive
router.delete('/:id', requireRole('owner'), async (req, res) => {
  const { school_id } = req.user;
  try {
    const result = await pool.query(
      `UPDATE students SET status = 'inactive' WHERE id = $1 AND school_id = $2 RETURNING id`,
      [req.params.id, school_id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    audit(req, 'DELETE', 'student', req.params.id, {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
