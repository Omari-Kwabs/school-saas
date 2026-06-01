-- extend_schema11.sql
-- Materialized views for analytics performance at scale.
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema11.sql','utf8')).then(()=>process.exit(0))"

-- ── Attendance summary: present/absent/late/excused per student per term ─────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_attendance_summary AS
SELECT
  a.school_id,
  a.student_id,
  t.id AS term_id,
  COUNT(*) FILTER (WHERE a.status = 'present')  AS present_count,
  COUNT(*) FILTER (WHERE a.status = 'absent')   AS absent_count,
  COUNT(*) FILTER (WHERE a.status = 'late')     AS late_count,
  COUNT(*) FILTER (WHERE a.status = 'excused')  AS excused_count,
  COUNT(*)                                        AS total_days
FROM attendance a
JOIN terms t ON t.school_id = a.school_id
  AND a.date >= t.start_date
  AND a.date <= t.end_date
GROUP BY a.school_id, a.student_id, t.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_attendance_summary_pk
  ON mv_attendance_summary (school_id, student_id, term_id);

-- ── Grade summary: average score per student per term (from grades table) ────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_grade_summary AS
SELECT
  school_id,
  student_id,
  term_id,
  ROUND(AVG(total_score)::numeric, 2) AS avg_score,
  COUNT(*)                             AS subject_count
FROM grades
GROUP BY school_id, student_id, term_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_grade_summary_pk
  ON mv_grade_summary (school_id, student_id, term_id);

-- ── Assessment result averages: per student per class per subject per term ───
-- Used by teacher-performance to replace the heavy STUDENT_AVG_SQL CTE.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_student_subject_averages AS
SELECT
  r.school_id,
  r.student_id,
  a.class_id,
  a.subject_id,
  a.term_id,
  ROUND((AVG(r.total_score::float / NULLIF(a.max_score, 0)::float) * 100)::numeric, 1) AS avg_pct,
  COUNT(*) AS assessment_count
FROM results r
JOIN assessments a ON a.id = r.assessment_id AND a.max_score > 0
GROUP BY r.school_id, r.student_id, a.class_id, a.subject_id, a.term_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_student_subject_averages_pk
  ON mv_student_subject_averages (school_id, student_id, class_id, subject_id, term_id);

CREATE INDEX IF NOT EXISTS idx_mv_student_subject_averages_class_term
  ON mv_student_subject_averages (school_id, class_id, subject_id, term_id);
