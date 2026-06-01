-- extend_schema4.sql
-- Performance indexes, dynamic privileges system, feeding enhancements

-- ── Performance indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_school_id   ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id    ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_status      ON students(status);
CREATE INDEX IF NOT EXISTS idx_payments_school_id   ON payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id  ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date        ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_attendance_school_id ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date      ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student   ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_school_id     ON grades(school_id);
CREATE INDEX IF NOT EXISTS idx_grades_student       ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_feeding_school_id    ON feeding_records(school_id);
CREATE INDEX IF NOT EXISTS idx_feeding_date         ON feeding_records(date);
CREATE INDEX IF NOT EXISTS idx_feeding_student      ON feeding_records(student_id);

-- ── Dynamic roles + privileges ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS school_roles (
  id         UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  label      TEXT    NOT NULL,
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS role_privileges (
  role_id   UUID NOT NULL REFERENCES school_roles(id) ON DELETE CASCADE,
  privilege TEXT NOT NULL,
  PRIMARY KEY (role_id, privilege)
);

-- ── Feeding enhancements ──────────────────────────────────────────────────────
ALTER TABLE feeding_records
  ADD COLUMN IF NOT EXISTS meal_type TEXT NOT NULL DEFAULT 'lunch'
    CHECK (meal_type IN ('breakfast','lunch','dinner','snack'));
