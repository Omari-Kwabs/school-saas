-- Targeted composite indexes for tenant-scoped hot paths.
-- These complement the broad single-column indexes in migrations/indexes.sql.

-- Student lists/search screens commonly filter by tenant, active status, class/family,
-- then sort by class order/name or student name.
CREATE INDEX IF NOT EXISTS idx_students_school_status_class_name
  ON students (school_id, status, class_id, name);

CREATE INDEX IF NOT EXISTS idx_students_school_family_status_name
  ON students (school_id, family_id, status, name);

CREATE INDEX IF NOT EXISTS idx_classes_school_order_name
  ON classes (school_id, order_num, name);

-- Term pickers and archive/current-term screens.
CREATE INDEX IF NOT EXISTS idx_terms_school_current
  ON terms (school_id, is_current);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terms' AND column_name = 'is_archived'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_terms_school_archived_start
             ON terms (school_id, is_archived, start_date DESC)';
  END IF;
END $$;

-- Attendance reads are class+date and student-history heavy.
CREATE INDEX IF NOT EXISTS idx_attendance_school_class_date_student
  ON attendance (school_id, class_id, date, student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_school_student_date_desc
  ON attendance (school_id, student_id, date DESC);

-- Assessment, result, and grade workflows filter by class/subject/term combinations.
CREATE INDEX IF NOT EXISTS idx_assessments_school_class_term_subject_created
  ON assessments (school_id, class_id, term_id, subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_school_assessment_student
  ON results (school_id, assessment_id, student_id);

CREATE INDEX IF NOT EXISTS idx_results_school_student_assessment
  ON results (school_id, student_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_grades_school_student_term_subject
  ON grades (school_id, student_id, term_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_grades_school_subject_term_student
  ON grades (school_id, subject_id, term_id, student_id);

-- Finance screens aggregate by plan, term, student, due date, and payment date.
CREATE INDEX IF NOT EXISTS idx_payment_plans_school_term_student
  ON payment_plans (school_id, term_id, student_id);

CREATE INDEX IF NOT EXISTS idx_payment_plans_school_fee_structure
  ON payment_plans (school_id, fee_structure_id);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_school_plan_due
  ON payment_schedules (school_id, plan_id, due_date);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_plan
  ON payment_schedules (due_date, plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_school_plan
  ON payments (school_id, plan_id);

CREATE INDEX IF NOT EXISTS idx_payments_school_student_date_desc
  ON payments (school_id, student_id, payment_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_payments_school_date_desc
  ON payments (school_id, payment_date DESC, id DESC);

DO $$
BEGIN
  IF to_regclass('public.fee_carry_forwards') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_carry_forwards_school_student_to_term
             ON fee_carry_forwards (school_id, student_id, to_term_id)';
  END IF;
END $$;

-- Operational feeds and audit views are newest-first per tenant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcements' AND column_name = 'deleted_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_announcements_school_active_audience_created
             ON announcements (school_id, is_active, audience, created_at DESC)
             WHERE deleted_at IS NULL';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_announcements_school_active_audience_created
             ON announcements (school_id, is_active, audience, created_at DESC)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created_desc
  ON audit_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_entity_created_desc
  ON audit_logs (school_id, entity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_user_created_desc
  ON audit_logs (school_id, user_id, created_at DESC);

-- Teaching scope checks happen on nearly every teacher-scoped request.
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_school_teacher_term
  ON teaching_assignments (school_id, teacher_id, term_id);

CREATE INDEX IF NOT EXISTS idx_teaching_assignments_school_class_subject_term
  ON teaching_assignments (school_id, class_id, subject_id, term_id);

ANALYZE students;
ANALYZE classes;
ANALYZE terms;
ANALYZE attendance;
ANALYZE assessments;
ANALYZE results;
ANALYZE grades;
ANALYZE payment_plans;
ANALYZE payment_schedules;
ANALYZE payments;
ANALYZE audit_logs;
ANALYZE announcements;
ANALYZE teaching_assignments;
