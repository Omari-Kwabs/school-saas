-- extend_schema18.sql
-- Database index optimization: drop 12 redundant/duplicate indexes, add 3 missing composite indexes.
--
-- Run ONCE from the backend directory:
--   node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema18.sql','utf8')).then(()=>process.exit(0))"

-- ── Drop exact duplicates of unique-constraint indexes ────────────────────────
-- results: unique constraint (school_id, student_id, assessment_id) already creates an index
DROP INDEX IF EXISTS idx_results_student_assessment;

-- feature_flags: unique constraint (school_id, flag_name) already creates an index
DROP INDEX IF EXISTS idx_feature_flags_school;

-- students: idx_students_class and idx_students_class_id are identical (class_id)
DROP INDEX IF EXISTS idx_students_class_id;

-- ── Drop indexes made redundant by wider composite indexes ────────────────────
-- assessments: (school_id) is the leading column of idx_assessments_subject_class_term
DROP INDEX IF EXISTS idx_assessments_school;

-- grades: (school_id) is the leading column of idx_grades_school(school_id, student_id)
DROP INDEX IF EXISTS idx_grades_school_id;

-- students: (school_id) is the leading column of idx_students_school(school_id, status)
DROP INDEX IF EXISTS idx_students_school_id;

-- attendance: (school_id) is the leading column of idx_attendance_school(school_id, class_id, date)
DROP INDEX IF EXISTS idx_attendance_school_id;

-- feeding_records: (school_id) is the leading column of idx_feeding_student(school_id, student_id)
DROP INDEX IF EXISTS idx_feeding_school_id;

-- payments: (school_id) is the leading column of idx_payments_school(school_id, student_id)
DROP INDEX IF EXISTS idx_payments_school_id;

-- ── Drop low-selectivity standalone date indexes ──────────────────────────────
-- date alone is never queried without a school_id filter in a multi-tenant DB
DROP INDEX IF EXISTS idx_attendance_date;
DROP INDEX IF EXISTS idx_feeding_date;

-- ── Drop full index superseded by partial index ───────────────────────────────
-- idx_payments_plan_id (plan_id) WHERE plan_id IS NOT NULL is smaller and covers all real lookups
DROP INDEX IF EXISTS idx_payments_plan;

-- ── Add missing composite indexes ─────────────────────────────────────────────
-- Grade report queries filter by school_id + term_id to get all grades for a term
CREATE INDEX IF NOT EXISTS idx_grades_school_term
  ON grades (school_id, term_id);

-- Grade compute fetches results WHERE school_id=$1 AND assessment_id = ANY($2::uuid[])
-- school_id prefix improves tenant isolation on the assessment_id lookup
CREATE INDEX IF NOT EXISTS idx_results_school_assessment
  ON results (school_id, assessment_id);

-- Financial report queries filter payments by school + date range
CREATE INDEX IF NOT EXISTS idx_payments_school_date
  ON payments (school_id, payment_date DESC);
