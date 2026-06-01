const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const requirePrivilege = require('../middleware/privilege');
const audit = require('../middleware/audit');
const { getTeacherScope, isDesignatedClassTeacher, SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();

function gradeInfo(total) {
  if (total == null) return { grade: null, meaning: null };
  if (total >= 80) return { grade: 'A1', meaning: 'Excellent' };
  if (total >= 75) return { grade: 'B2', meaning: 'Very Good' };
  if (total >= 70) return { grade: 'B3', meaning: 'Good' };
  if (total >= 65) return { grade: 'C4', meaning: 'Credit' };
  if (total >= 60) return { grade: 'C5', meaning: 'Credit' };
  if (total >= 55) return { grade: 'C6', meaning: 'Credit' };
  if (total >= 50) return { grade: 'D7', meaning: 'Approaching Proficiency' };
  if (total >= 45) return { grade: 'E8', meaning: 'Pass' };
  return { grade: 'F9', meaning: 'Fail' };
}

// Types that count toward the 20% classwork+homework component.
// Legacy AfL/AaL/AoL are included for backward compatibility.
const CLASSWORK_TYPES = new Set(['classwork', 'homework', 'AfL', 'AaL', 'AoL']);

// Average a list of 0–1 percentages, return 0 for empty list.
function avgPct(pcts) {
  return pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0;
}

function round2(n) { return Math.round(n * 100) / 100; }

// GET / — students in a class for a subject/term with subject positions
router.get('/', requirePrivilege('academic:read'), async (req, res) => {
  const { class_id, term_id, subject_id } = req.query;
  if (!class_id || !term_id || !subject_id) {
    return res.status(400).json({ error: 'class_id, term_id and subject_id required' });
  }
  try {
    const scope = await getTeacherScope(req.user, term_id);
    if (scope && !scope.isTeacherOf(class_id, subject_id)) {
      return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
    }

    const result = await pool.query(
      `SELECT s.id AS student_id, s.name, s.student_code,
              g.id AS grade_id,
              g.classwork_score, g.class_test_score, g.class_score, g.exam_score,
              g.teacher_name,
              COALESCE(g.class_score, 0) + COALESCE(g.exam_score, 0) AS total_score,
              RANK() OVER (ORDER BY COALESCE(g.class_score, 0) + COALESCE(g.exam_score, 0) DESC)
                AS subj_pos_class
       FROM students s
       LEFT JOIN grades g ON g.student_id = s.id AND g.subject_id = $3 AND g.term_id = $4
                          AND g.school_id = $1
       WHERE s.school_id = $1 AND s.class_id = $2 AND s.status = 'active'
       ORDER BY s.name`,
      [req.user.school_id, class_id, subject_id, term_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /compute — derive grades from results for a class+subject+term.
//
// Weights:
//   classwork + homework  → 20 marks  (average % of all recorded × 20)
//   class_test            → 20 marks  (average % of all recorded × 20)
//   class_score           = classwork_score + class_test_score  (max 40)
//   exam                  → 60 marks  (% × 60)
//   total                 = class_score + exam_score            (max 100)
//
// Teachers may only compute grades for their assigned class+subject.
router.post('/compute', requirePrivilege('academic:write'), async (req, res) => {
  const { class_id, subject_id, term_id } = req.body;
  const { school_id, id: recorded_by, name: teacher_name } = req.user;
  if (!class_id || !subject_id || !term_id) {
    return res.status(400).json({ error: 'class_id, subject_id and term_id required' });
  }

  const scope = await getTeacherScope(req.user);
  if (scope && !scope.isTeacherOf(class_id, subject_id)) {
    return res.status(403).json({ error: 'You are not assigned to teach this subject in this class' });
  }

  try {
    const { rows: students } = await pool.query(
      `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND status='active'`,
      [school_id, class_id]
    );
    if (!students.length) return res.json({ success: true, computed: 0 });

    // All assessments for this subject+class+term, with each student's result
    const { rows: asmRows } = await pool.query(
      `SELECT a.id AS assessment_id, a.type, a.max_score,
              r.student_id, r.total_score
       FROM assessments a
       LEFT JOIN results r ON r.assessment_id = a.id AND r.school_id = $1
       WHERE a.school_id=$1 AND a.subject_id=$2 AND a.class_id=$3 AND a.term_id=$4
         AND a.max_score > 0`,
      [school_id, subject_id, class_id, term_id]
    );

    // Compute all grades in JS first, then batch-insert in a single statement
    const gradeRows = [];
    for (const student of students) {
      const sRows = asmRows.filter(r => r.student_id === student.id);

      const cwPcts = sRows
        .filter(r => CLASSWORK_TYPES.has(r.type) && r.total_score != null)
        .map(r => parseFloat(r.total_score) / parseFloat(r.max_score));
      const classworkScore = round2(avgPct(cwPcts) * 20);

      const ctPcts = sRows
        .filter(r => r.type === 'class_test' && r.total_score != null)
        .map(r => parseFloat(r.total_score) / parseFloat(r.max_score));
      const classTestScore = round2(avgPct(ctPcts) * 20);

      const classScore = round2(classworkScore + classTestScore);

      const examRow = sRows.find(r => r.type === 'exam' && r.total_score != null);
      const examScore = examRow
        ? round2((parseFloat(examRow.total_score) / parseFloat(examRow.max_score)) * 60)
        : null;

      gradeRows.push([school_id, student.id, subject_id, term_id,
                      classworkScore, classTestScore, classScore, examScore,
                      teacher_name, recorded_by]);
    }

    if (!gradeRows.length) return res.json({ success: true, computed: 0 });

    const placeholders = gradeRows.map((_, i) => {
      const b = i * 10;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`;
    }).join(',');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO grades
           (school_id, student_id, subject_id, term_id,
            classwork_score, class_test_score, class_score, exam_score,
            teacher_name, recorded_by)
         VALUES ${placeholders}
         ON CONFLICT (school_id, student_id, subject_id, term_id)
         DO UPDATE SET
           classwork_score  = EXCLUDED.classwork_score,
           class_test_score = EXCLUDED.class_test_score,
           class_score      = EXCLUDED.class_score,
           exam_score       = EXCLUDED.exam_score,
           teacher_name     = EXCLUDED.teacher_name,
           recorded_by      = EXCLUDED.recorded_by`,
        gradeRows.flat()
      );
      await client.query('COMMIT');
      audit(req, 'COMPUTE', 'grades', subject_id, { subject_id, term_id, class_id, count: gradeRows.length });
      res.json({ success: true, computed: gradeRows.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bulk — admin-only manual grade override.
// Teachers must use POST /grades/compute (results-driven workflow).
router.post('/bulk', requirePrivilege('academic:write'), async (req, res) => {
  const { subject_id, term_id, class_id, records } = req.body;
  const { school_id, id: recorded_by, name: user_name } = req.user;

  if (!subject_id || !term_id || !class_id || !Array.isArray(records)) {
    return res.status(400).json({ error: 'subject_id, term_id, class_id and records required' });
  }

  if (SCOPED_ROLES.has(req.user.role)) {
    return res.status(403).json({ error: 'Teachers must use POST /grades/compute to derive grades from results' });
  }

  const studentIds = [...new Set(records.map(r => r.student_id))];
  const scopeCheck = await pool.query(
    `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND id = ANY($3)`,
    [school_id, class_id, studentIds]
  );
  if (scopeCheck.rows.length !== studentIds.length) {
    return res.status(400).json({ error: 'One or more student_ids do not belong to this class' });
  }

  const rows = records
    .filter(r => r.student_id)
    .map(r => [school_id, r.student_id, subject_id, term_id,
               r.class_score ?? null, r.exam_score ?? null,
               user_name, recorded_by]);

  if (!rows.length) return res.json({ success: true, count: 0 });

  const placeholders = rows.map((_, i) => {
    const b = i * 8;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
  }).join(',');

  try {
    await pool.query(
      `INSERT INTO grades (school_id, student_id, subject_id, term_id,
         class_score, exam_score, teacher_name, recorded_by)
       VALUES ${placeholders}
       ON CONFLICT (school_id, student_id, subject_id, term_id)
       DO UPDATE SET class_score  = EXCLUDED.class_score,
                     exam_score   = EXCLUDED.exam_score,
                     teacher_name = EXCLUDED.teacher_name,
                     recorded_by  = EXCLUDED.recorded_by`,
      rows.flat()
    );
    audit(req, 'BULK_UPSERT', 'grades', subject_id, { subject_id, term_id, count: rows.length });
    res.json({ success: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /remarks/:student_id — terminal remarks for a student/term
router.get('/remarks/:student_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  if (!term_id) return res.status(400).json({ error: 'term_id required' });

  if (SCOPED_ROLES.has(req.user.role)) {
    const studentRes = await pool.query(
      'SELECT class_id FROM students WHERE school_id=$1 AND id=$2',
      [school_id, req.params.student_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    const isClassTeacher = await isDesignatedClassTeacher(req.user, studentRes.rows[0].class_id);
    if (!isClassTeacher) {
      return res.status(403).json({ error: 'Only the class teacher can access terminal remarks' });
    }
  }

  try {
    const result = await pool.query(
      `SELECT * FROM student_terminal_remarks
       WHERE school_id=$1 AND student_id=$2 AND term_id=$3`,
      [school_id, req.params.student_id, term_id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /remarks — upsert terminal remarks (class teacher or admin only)
router.post('/remarks', requirePrivilege('academic:write'), async (req, res) => {
  const { student_id, term_id, interest, conduct, attitude,
          class_teacher_remark, academic_remark } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!student_id || !term_id) {
    return res.status(400).json({ error: 'student_id and term_id required' });
  }

  const studentRes = await pool.query(
    `SELECT id, class_id FROM students WHERE school_id=$1 AND id=$2`,
    [school_id, student_id]
  );
  if (!studentRes.rows.length) return res.status(400).json({ error: 'Student not found' });

  if (SCOPED_ROLES.has(req.user.role)) {
    const isClassTeacher = await isDesignatedClassTeacher(req.user, studentRes.rows[0].class_id);
    if (!isClassTeacher) {
      return res.status(403).json({ error: 'Only the class teacher can write terminal remarks' });
    }
  }

  try {
    await pool.query(
      `INSERT INTO student_terminal_remarks
         (school_id, student_id, term_id, interest, conduct, attitude,
          class_teacher_remark, academic_remark, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (school_id, student_id, term_id)
       DO UPDATE SET interest=EXCLUDED.interest, conduct=EXCLUDED.conduct,
         attitude=EXCLUDED.attitude,
         class_teacher_remark=EXCLUDED.class_teacher_remark,
         academic_remark=EXCLUDED.academic_remark,
         recorded_by=EXCLUDED.recorded_by`,
      [school_id, student_id, term_id, interest || null, conduct || null,
       attitude || null, class_teacher_remark || null, academic_remark || null, recorded_by]
    );
    audit(req, 'UPSERT', 'grade_remarks', student_id, { student_id, term_id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /remarks/bulk — upsert terminal remarks for multiple students at once (class teacher or admin only)
router.post('/remarks/bulk', requirePrivilege('academic:write'), async (req, res) => {
  const { term_id, class_id, records } = req.body;
  const { school_id, id: recorded_by } = req.user;
  if (!term_id || !class_id || !Array.isArray(records) || !records.length) {
    return res.status(400).json({ error: 'term_id, class_id and records array required' });
  }

  if (SCOPED_ROLES.has(req.user.role)) {
    const isClassTeacher = await isDesignatedClassTeacher(req.user, class_id);
    if (!isClassTeacher) {
      return res.status(403).json({ error: 'Only the class teacher can write terminal remarks' });
    }
  }

  // Validate all student_ids belong to this class
  const studentIds = [...new Set(records.map(r => r.student_id).filter(Boolean))];
  if (!studentIds.length) return res.status(400).json({ error: 'No valid student_ids in records' });

  const scopeCheck = await pool.query(
    `SELECT id FROM students WHERE school_id=$1 AND class_id=$2 AND id = ANY($3)`,
    [school_id, class_id, studentIds]
  );
  if (scopeCheck.rows.length !== studentIds.length) {
    return res.status(400).json({ error: 'One or more students do not belong to this class' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of records) {
      if (!r.student_id) continue;
      await client.query(
        `INSERT INTO student_terminal_remarks
           (school_id, student_id, term_id, interest, conduct, attitude,
            class_teacher_remark, academic_remark, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (school_id, student_id, term_id)
         DO UPDATE SET interest=EXCLUDED.interest, conduct=EXCLUDED.conduct,
           attitude=EXCLUDED.attitude,
           class_teacher_remark=EXCLUDED.class_teacher_remark,
           academic_remark=EXCLUDED.academic_remark,
           recorded_by=EXCLUDED.recorded_by`,
        [school_id, r.student_id, term_id,
         r.interest || null, r.conduct || null, r.attitude || null,
         r.class_teacher_remark || null, r.academic_remark || null, recorded_by]
      );
    }
    await client.query('COMMIT');
    audit(req, 'BULK_UPSERT', 'grade_remarks', class_id, { class_id, term_id, count: records.length });
    res.json({ success: true, count: records.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /student/:student_id — all grades for a student (optionally filtered by term)
router.get('/student/:student_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;

  const scope = await getTeacherScope(req.user);
  if (scope) {
    const studentRes = await pool.query(
      'SELECT class_id FROM students WHERE school_id=$1 AND id=$2',
      [school_id, req.params.student_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    if (!scope.classIds.includes(studentRes.rows[0].class_id)) {
      return res.status(403).json({ error: 'Student is not in any of your assigned classes' });
    }
  }

  try {
    let query, params;
    if (term_id) {
      query = `SELECT g.*, sub.name AS subject_name, sub.code AS subject_code,
                      COALESCE(g.class_score, 0) + COALESCE(g.exam_score, 0) AS total_score
               FROM grades g JOIN subjects sub ON sub.id = g.subject_id
               WHERE g.school_id = $1 AND g.student_id = $2 AND g.term_id = $3
               ORDER BY sub.name`;
      params = [school_id, req.params.student_id, term_id];
    } else {
      query = `SELECT g.*, sub.name AS subject_name, sub.code AS subject_code,
                      t.name AS term_name,
                      COALESCE(g.class_score, 0) + COALESCE(g.exam_score, 0) AS total_score
               FROM grades g
               JOIN subjects sub ON sub.id = g.subject_id
               JOIN terms t ON t.id = g.term_id
               WHERE g.school_id = $1 AND g.student_id = $2
               ORDER BY t.start_date DESC, sub.name`;
      params = [school_id, req.params.student_id];
    }
    res.json((await pool.query(query, params)).rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /report/:student_id — full subject report with grade info and class positions
router.get('/report/:student_id', requirePrivilege('academic:read'), async (req, res) => {
  const { school_id } = req.user;
  const { term_id } = req.query;
  if (!term_id) return res.status(400).json({ error: 'term_id required' });

  const scope = await getTeacherScope(req.user);
  if (scope) {
    const studentRes = await pool.query(
      'SELECT class_id FROM students WHERE school_id=$1 AND id=$2',
      [school_id, req.params.student_id]
    );
    if (!studentRes.rows.length) return res.status(404).json({ error: 'Student not found' });
    if (!scope.classIds.includes(studentRes.rows[0].class_id)) {
      return res.status(403).json({ error: 'Student is not in any of your assigned classes' });
    }
  }

  try {
    const result = await pool.query(
      `WITH student_class AS (
         SELECT class_id FROM students WHERE id = $2 AND school_id = $1
       ),
       class_grades AS (
         SELECT g.student_id, g.subject_id,
                COALESCE(g.class_score,0) + COALESCE(g.exam_score,0) AS total,
                RANK() OVER (
                  PARTITION BY g.subject_id
                  ORDER BY COALESCE(g.class_score,0) + COALESCE(g.exam_score,0) DESC
                ) AS pos
         FROM grades g
         JOIN students s ON s.id = g.student_id
         WHERE g.school_id = $1
           AND g.term_id = $3
           AND s.class_id = (SELECT class_id FROM student_class)
           AND s.status = 'active'
       )
       SELECT sub.name AS subject, sub.code,
              g.classwork_score, g.class_test_score, g.class_score, g.exam_score,
              g.teacher_name,
              COALESCE(g.class_score,0) + COALESCE(g.exam_score,0) AS total_score,
              cg.pos AS subj_pos_class
       FROM subjects sub
       LEFT JOIN grades g ON g.subject_id = sub.id AND g.student_id = $2
                          AND g.term_id = $3 AND g.school_id = $1
       LEFT JOIN class_grades cg ON cg.subject_id = sub.id AND cg.student_id = $2
       WHERE sub.school_id = $1
       ORDER BY sub.name`,
      [school_id, req.params.student_id, term_id]
    );
    const rows = result.rows.map(r => {
      const hasScores = r.class_score != null || r.exam_score != null;
      const total = parseFloat(r.total_score) || 0;
      const { grade, meaning } = hasScores ? gradeInfo(total) : { grade: null, meaning: null };
      return { ...r, grade, grade_meaning: meaning };
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
