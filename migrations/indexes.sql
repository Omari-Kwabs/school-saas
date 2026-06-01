-- Performance indexes on hot query columns
-- Run once against the database: psql $DATABASE_URL -f migrations/indexes.sql

CREATE INDEX IF NOT EXISTS idx_students_school_id       ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id        ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status          ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_school_status   ON students(school_id, status);

CREATE INDEX IF NOT EXISTS idx_grades_school_id         ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id        ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_term_id           ON grades(term_id);
CREATE INDEX IF NOT EXISTS idx_grades_assessment_id     ON grades(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessments_school_id    ON assessments(school_id);
CREATE INDEX IF NOT EXISTS idx_assessments_class_id     ON assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_term_id      ON assessments(term_id);

CREATE INDEX IF NOT EXISTS idx_payments_school_id       ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id      ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_plan_id         ON payments(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date    ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_payment_plans_school_id  ON payment_plans(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_student_id ON payment_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_term_id    ON payment_plans(term_id);

CREATE INDEX IF NOT EXISTS idx_payment_schedules_plan_id  ON payment_schedules(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date ON payment_schedules(due_date);

CREATE INDEX IF NOT EXISTS idx_attendance_school_id     ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id    ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date          ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date    ON attendance(class_id, date);

CREATE INDEX IF NOT EXISTS idx_diagnostic_results_school_id   ON diagnostic_results(school_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_results_student_id  ON diagnostic_results(student_id);

CREATE INDEX IF NOT EXISTS idx_remediation_flags_school_id    ON remediation_flags(school_id);
CREATE INDEX IF NOT EXISTS idx_remediation_flags_student_id   ON remediation_flags(student_id);
CREATE INDEX IF NOT EXISTS idx_remediation_flags_status       ON remediation_flags(status);

CREATE INDEX IF NOT EXISTS idx_feedback_school_id       ON feedback(school_id);
CREATE INDEX IF NOT EXISTS idx_feedback_student_id      ON feedback(student_id);

CREATE INDEX IF NOT EXISTS idx_users_school_id          ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_email              ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school_email       ON users(school_id, email);

CREATE INDEX IF NOT EXISTS idx_memos_school_id          ON memos(school_id);
CREATE INDEX IF NOT EXISTS idx_memos_to_id              ON memos(to_id);
CREATE INDEX IF NOT EXISTS idx_memos_from_id            ON memos(from_id);

CREATE INDEX IF NOT EXISTS idx_announcements_school_id  ON announcements(school_id);
CREATE INDEX IF NOT EXISTS idx_announcements_audience   ON announcements(audience);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id     ON audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON audit_logs(created_at);
