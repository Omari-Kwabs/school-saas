const express = require('express');
const pool = require('../config/db');
const requireRole = require('../middleware/roles');
const { SCOPED_ROLES } = require('../lib/teacherScope');

const router = express.Router();
const ALLOWED = ['owner', 'headmaster_academics', 'headmaster_admin'];

function key(class_id, subject_id) { return `${class_id}:${subject_id}`; }
function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function fmt1(v) { return v != null ? parseFloat(parseFloat(v).toFixed(1)) : null; }
function pct(n, d) { return d > 0 ? fmt1((n / d) * 100) : null; }

// Shared: student averages + pass/high rates per (class_id, subject_id)
const STUDENT_AVG_SQL = `
  WITH sa AS (
    SELECT r.student_id, a.class_id, a.subject_id,
           AVG((r.total_score::float / a.max_score::float) * 100) AS avg_pct
    FROM results r
    JOIN assessments a ON a.id = r.assessment_id
      AND a.term_id = $1 AND a.school_id = $2 AND a.max_score > 0
    WHERE a.class_id = ANY($3)
    GROUP BY r.student_id, a.class_id, a.subject_id
  )
  SELECT class_id, subject_id,
    ROUND(AVG(avg_pct)::numeric, 1)                                                    AS class_avg,
    COUNT(*)                                                                            AS students_assessed,
    ROUND((COUNT(*) FILTER(WHERE avg_pct >= 50)::float / NULLIF(COUNT(*),0)*100)::numeric,1) AS pass_rate,
    ROUND((COUNT(*) FILTER(WHERE avg_pct >= 75)::float / NULLIF(COUNT(*),0)*100)::numeric,1) AS high_rate
  FROM sa
  GROUP BY class_id, subject_id
`;

// Shared: first-vs-last assessment trajectory per student per (class_id, subject_id)
const TRAJECTORY_SQL = `
  WITH ranked AS (
    SELECT r.student_id, a.class_id, a.subject_id,
           (r.total_score::float / a.max_score::float) * 100 AS pct,
           ROW_NUMBER() OVER(PARTITION BY r.student_id,a.class_id,a.subject_id ORDER BY a.created_at ASC)  AS rn_asc,
           ROW_NUMBER() OVER(PARTITION BY r.student_id,a.class_id,a.subject_id ORDER BY a.created_at DESC) AS rn_desc,
           COUNT(*)    OVER(PARTITION BY r.student_id,a.class_id,a.subject_id)                             AS total
    FROM results r
    JOIN assessments a ON a.id = r.assessment_id
      AND a.term_id = $1 AND a.school_id = $2 AND a.max_score > 0
    WHERE a.class_id = ANY($3)
  ),
  fl AS (
    SELECT student_id, class_id, subject_id, MAX(total) AS cnt,
           MAX(CASE WHEN rn_asc  = 1 THEN pct END) AS first_score,
           MAX(CASE WHEN rn_desc = 1 THEN pct END) AS last_score
    FROM ranked
    GROUP BY student_id, class_id, subject_id
  )
  SELECT class_id, subject_id,
    COUNT(*)                                                         FILTER(WHERE cnt >= 2) AS with_trajectory,
    COUNT(*)                                                         FILTER(WHERE cnt >= 2 AND last_score > first_score) AS improved,
    COUNT(*)                                                         FILTER(WHERE cnt >= 2 AND first_score < 50 AND last_score >= 50) AS recovered,
    COUNT(*)                                                         FILTER(WHERE cnt >= 2 AND first_score < 50) AS initially_weak
  FROM fl
  GROUP BY class_id, subject_id
`;

// ── Overview: all teachers ────────────────────────────────────────────────────
router.get('/term/:term_id', requireRole(...ALLOWED), async (req, res) => {
  const { term_id } = req.params;
  const { school_id } = req.user;

  try {
    const termRes = await pool.query(
      'SELECT id, name, start_date, end_date FROM terms WHERE school_id=$1 AND id=$2',
      [school_id, term_id]
    );
    if (!termRes.rows.length) return res.status(404).json({ error: 'Term not found' });
    const term = termRes.rows[0];

    const teachersRes = await pool.query(`
      SELECT DISTINCT u.id, u.name, u.role
      FROM users u
      JOIN teaching_assignments ta ON ta.teacher_id = u.id AND ta.school_id = $1
      WHERE u.school_id = $1 AND u.is_active = true
        AND u.role IN ('teacher','class_teacher','department_head','headmaster_academics')
      ORDER BY u.name
    `, [school_id]);

    if (!teachersRes.rows.length) return res.json({ term, teachers: [] });

    const teacherIds = teachersRes.rows.map(t => t.id);

    const assignmentsRes = await pool.query(`
      SELECT ta.teacher_id, ta.class_id, ta.subject_id, c.name AS class_name, s.name AS subject_name
      FROM teaching_assignments ta
      JOIN classes  c ON c.id = ta.class_id
      JOIN subjects s ON s.id = ta.subject_id
      WHERE ta.school_id = $1 AND ta.teacher_id = ANY($2)
    `, [school_id, teacherIds]);

    if (!assignmentsRes.rows.length) {
      return res.json({
        term,
        teachers: teachersRes.rows.map(t => ({ teacher_id: t.id, name: t.name, role: t.role, outcomes: [], summary: null }))
      });
    }

    const classIds = [...new Set(assignmentsRes.rows.map(a => a.class_id))];

    const [avgRes, trajRes, remRes] = await Promise.all([
      pool.query(STUDENT_AVG_SQL, [term_id, school_id, classIds]),
      pool.query(TRAJECTORY_SQL,  [term_id, school_id, classIds]),
      pool.query(`
        SELECT st.class_id, rf.status, COUNT(*) AS cnt
        FROM remediation_flags rf
        JOIN students st ON st.id = rf.student_id AND st.school_id = $1 AND st.status = 'active'
        WHERE st.class_id = ANY($2)
        GROUP BY st.class_id, rf.status
      `, [school_id, classIds])
    ]);

    const avgMap  = Object.fromEntries(avgRes.rows.map(r => [key(r.class_id, r.subject_id), r]));
    const trajMap = Object.fromEntries(trajRes.rows.map(r => [key(r.class_id, r.subject_id), r]));

    const remMap = {};
    remRes.rows.forEach(r => {
      if (!remMap[r.class_id]) remMap[r.class_id] = { closed: 0, pending: 0 };
      const closed = ['closed', 'resolved'].includes(r.status);
      remMap[r.class_id][closed ? 'closed' : 'pending'] += parseInt(r.cnt);
    });

    const teachers = teachersRes.rows.map(teacher => {
      const assigns = assignmentsRes.rows.filter(a => a.teacher_id === teacher.id);

      const outcomes = assigns.map(a => {
        const av  = avgMap[key(a.class_id, a.subject_id)]  || {};
        const tr  = trajMap[key(a.class_id, a.subject_id)] || {};
        const rem = remMap[a.class_id] || { closed: 0, pending: 0 };

        const withTraj    = parseInt(tr.with_trajectory)  || 0;
        const improved    = parseInt(tr.improved)          || 0;
        const recovered   = parseInt(tr.recovered)         || 0;
        const initWeak    = parseInt(tr.initially_weak)    || 0;
        const totalRem    = rem.closed + rem.pending;

        return {
          class_id:    a.class_id,   class_name:   a.class_name,
          subject_id:  a.subject_id, subject_name: a.subject_name,
          students_assessed:     parseInt(av.students_assessed) || 0,
          class_avg:             fmt1(av.class_avg),
          pass_rate:             fmt1(av.pass_rate),
          high_rate:             fmt1(av.high_rate),
          students_with_trajectory: withTraj,
          improved_count:        improved,
          improvement_rate:      pct(improved, withTraj),
          recovered_count:       recovered,
          initially_weak:        initWeak,
          recovery_rate:         pct(recovered, initWeak),
          remediation_closed:    rem.closed,
          remediation_pending:   rem.pending,
          remediation_success_rate: pct(rem.closed, totalRem)
        };
      });

      const withData = outcomes.filter(o => o.class_avg != null);
      const withImp  = outcomes.filter(o => o.improvement_rate != null);
      const withRec  = outcomes.filter(o => o.recovery_rate != null);
      const withRem  = outcomes.filter(o => o.remediation_success_rate != null);

      const summary = {
        avg_class_avg:        fmt1(avg(withData.map(o => o.class_avg))),
        avg_pass_rate:        fmt1(avg(withData.filter(o => o.pass_rate != null).map(o => o.pass_rate))),
        avg_high_rate:        fmt1(avg(withData.filter(o => o.high_rate != null).map(o => o.high_rate))),
        avg_improvement_rate: fmt1(avg(withImp.map(o => o.improvement_rate))),
        avg_recovery_rate:    fmt1(avg(withRec.map(o => o.recovery_rate))),
        avg_remediation_rate: fmt1(avg(withRem.map(o => o.remediation_success_rate))),
        total_recovered:      outcomes.reduce((s, o) => s + o.recovered_count, 0)
      };

      return { teacher_id: teacher.id, name: teacher.name, role: teacher.role, outcomes, summary };
    });

    res.json({ term, teachers });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Self-view: teacher sees their own performance ─────────────────────────────
router.get('/me/term/:term_id', async (req, res) => {
  if (!SCOPED_ROLES.has(req.user.role) && !ALLOWED.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  req.params.teacher_id = req.user.id;
  return selfOrDetailHandler(req, res);
});

// ── Detail: one teacher (admin view) ─────────────────────────────────────────
router.get('/:teacher_id/term/:term_id', requireRole(...ALLOWED), async (req, res) => {
  return selfOrDetailHandler(req, res);
});

async function selfOrDetailHandler(req, res) {
  const { teacher_id, term_id } = req.params;
  const { school_id } = req.user;

  try {
    const [teacherRes, termRes] = await Promise.all([
      pool.query('SELECT id, name, role FROM users WHERE school_id=$1 AND id=$2', [school_id, teacher_id]),
      pool.query('SELECT id, name, start_date, end_date FROM terms WHERE school_id=$1 AND id=$2', [school_id, term_id])
    ]);
    if (!teacherRes.rows.length) return res.status(404).json({ error: 'Teacher not found' });
    if (!termRes.rows.length)   return res.status(404).json({ error: 'Term not found' });

    const teacher = teacherRes.rows[0];
    const term    = termRes.rows[0];

    const assignmentsRes = await pool.query(`
      SELECT ta.class_id, ta.subject_id, c.name AS class_name, s.name AS subject_name
      FROM teaching_assignments ta
      JOIN classes  c ON c.id = ta.class_id
      JOIN subjects s ON s.id = ta.subject_id
      WHERE ta.school_id = $1 AND ta.teacher_id = $2
    `, [school_id, teacher_id]);

    if (!assignmentsRes.rows.length) return res.json({ teacher, term, outcomes: [] });

    const classIds   = assignmentsRes.rows.map(a => a.class_id);
    const subjectIds = [...new Set(assignmentsRes.rows.map(a => a.subject_id))];

    const [avgRes, studentsRes, crossRes, remRes] = await Promise.all([
      // Class/subject stats
      pool.query(STUDENT_AVG_SQL, [term_id, school_id, classIds]),

      // Per-student trajectories with names (need >= 2 assessments)
      pool.query(`
        WITH ranked AS (
          SELECT r.student_id, a.class_id, a.subject_id,
                 (r.total_score::float / a.max_score::float) * 100 AS pct,
                 ROW_NUMBER() OVER(PARTITION BY r.student_id,a.class_id,a.subject_id ORDER BY a.created_at ASC)  AS rn_asc,
                 ROW_NUMBER() OVER(PARTITION BY r.student_id,a.class_id,a.subject_id ORDER BY a.created_at DESC) AS rn_desc,
                 COUNT(*)    OVER(PARTITION BY r.student_id,a.class_id,a.subject_id)                             AS total
          FROM results r
          JOIN assessments a ON a.id = r.assessment_id
            AND a.term_id = $1 AND a.school_id = $2 AND a.max_score > 0
          WHERE a.class_id = ANY($3)
        ),
        fl AS (
          SELECT student_id, class_id, subject_id, MAX(total) AS cnt,
                 ROUND(MAX(CASE WHEN rn_asc  = 1 THEN pct END)::numeric, 1) AS first_score,
                 ROUND(MAX(CASE WHEN rn_desc = 1 THEN pct END)::numeric, 1) AS last_score
          FROM ranked
          GROUP BY student_id, class_id, subject_id
          HAVING MAX(total) >= 2
        )
        SELECT fl.class_id, fl.subject_id,
               st.id AS student_id, st.name AS student_name, st.student_code,
               fl.first_score, fl.last_score,
               (fl.first_score < 50 AND fl.last_score >= 50) AS recovered,
               (fl.first_score < 50 AND fl.last_score <  50) AS still_weak,
               (fl.last_score > fl.first_score)              AS improved
        FROM fl
        JOIN students st ON st.id = fl.student_id
        ORDER BY fl.class_id, fl.subject_id, fl.first_score ASC
      `, [term_id, school_id, classIds]),

      // Cross-class comparison: all classes for subjects this teacher teaches
      pool.query(`
        WITH ca AS (
          SELECT a.class_id, a.subject_id,
                 AVG((r.total_score::float / a.max_score::float) * 100) AS avg_pct,
                 COUNT(DISTINCT r.student_id)                            AS student_count
          FROM results r
          JOIN assessments a ON a.id = r.assessment_id
            AND a.term_id = $1 AND a.school_id = $2 AND a.max_score > 0
          WHERE a.subject_id = ANY($3)
          GROUP BY a.class_id, a.subject_id
        )
        SELECT ca.class_id, c.name AS class_name, ca.subject_id, s.name AS subject_name,
               ROUND(ca.avg_pct::numeric, 1)  AS avg_pct,
               ca.student_count,
               RANK()  OVER(PARTITION BY ca.subject_id ORDER BY ca.avg_pct DESC) AS rank,
               COUNT(*) OVER(PARTITION BY ca.subject_id)                         AS total_classes
        FROM ca
        JOIN classes  c ON c.id = ca.class_id
        JOIN subjects s ON s.id = ca.subject_id
        ORDER BY ca.subject_id, ca.avg_pct DESC
      `, [term_id, school_id, subjectIds]),

      // Remediation for this teacher's classes
      pool.query(`
        SELECT st.class_id, rf.status, COUNT(*) AS cnt
        FROM remediation_flags rf
        JOIN students st ON st.id = rf.student_id AND st.school_id = $1 AND st.status = 'active'
        WHERE st.class_id = ANY($2)
        GROUP BY st.class_id, rf.status
      `, [school_id, classIds])
    ]);

    // Build maps
    const avgMap = Object.fromEntries(avgRes.rows.map(r => [key(r.class_id, r.subject_id), r]));

    const remMap = {};
    remRes.rows.forEach(r => {
      if (!remMap[r.class_id]) remMap[r.class_id] = { closed: 0, pending: 0 };
      const closed = ['closed', 'resolved'].includes(r.status);
      remMap[r.class_id][closed ? 'closed' : 'pending'] += parseInt(r.cnt);
    });

    // Cross-class grouped by subject
    const crossMap = {};
    crossRes.rows.forEach(r => {
      if (!crossMap[r.subject_id]) crossMap[r.subject_id] = [];
      crossMap[r.subject_id].push({
        class_id:      r.class_id,
        class_name:    r.class_name,
        avg_pct:       parseFloat(r.avg_pct),
        student_count: parseInt(r.student_count),
        rank:          parseInt(r.rank),
        total_classes: parseInt(r.total_classes),
        is_mine:       classIds.includes(r.class_id)
      });
    });

    // Students indexed by class:subject
    const studentMap = {};
    studentsRes.rows.forEach(r => {
      const k = key(r.class_id, r.subject_id);
      if (!studentMap[k]) studentMap[k] = [];
      studentMap[k].push(r);
    });

    const outcomes = assignmentsRes.rows.map(a => {
      const k   = key(a.class_id, a.subject_id);
      const av  = avgMap[k] || {};
      const rem = remMap[a.class_id] || { closed: 0, pending: 0 };
      const sts = studentMap[k] || [];
      const cross = crossMap[a.subject_id] || [];

      const withTraj  = sts.length;
      const improved  = sts.filter(s => s.improved).length;
      const recovered = sts.filter(s => s.recovered);
      const stillWeak = sts.filter(s => s.still_weak);
      const initWeak  = sts.filter(s => s.first_score < 50).length;
      const totalRem  = rem.closed + rem.pending;

      const myRank = cross.find(c => c.class_id === a.class_id);

      return {
        class_id:    a.class_id,   class_name:   a.class_name,
        subject_id:  a.subject_id, subject_name: a.subject_name,
        students_assessed:        parseInt(av.students_assessed) || 0,
        class_avg:                fmt1(av.class_avg),
        pass_rate:                fmt1(av.pass_rate),
        high_rate:                fmt1(av.high_rate),
        students_with_trajectory: withTraj,
        improved_count:           improved,
        improvement_rate:         pct(improved, withTraj),
        recovered_count:          recovered.length,
        initially_weak:           initWeak,
        recovery_rate:            pct(recovered.length, initWeak),
        remediation_closed:       rem.closed,
        remediation_pending:      rem.pending,
        remediation_success_rate: pct(rem.closed, totalRem),
        subject_rank:             myRank ? myRank.rank         : null,
        total_classes_for_subject:myRank ? myRank.total_classes: null,
        cross_class_comparison:   cross,
        recovered_students: recovered.map(s => ({
          name: s.student_name, student_code: s.student_code,
          first_score: parseFloat(s.first_score), last_score: parseFloat(s.last_score)
        })),
        still_weak_students: stillWeak.map(s => ({
          name: s.student_name, student_code: s.student_code,
          first_score: parseFloat(s.first_score), last_score: parseFloat(s.last_score)
        }))
      };
    });

    res.json({ teacher, term, outcomes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = router;
