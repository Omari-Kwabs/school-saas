-- extend_schema3.sql
-- Run ONCE:  node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema3.sql','utf8')).then(()=>process.exit(0))"

-- ── Attendance ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id)  ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present'
                CHECK (status IN ('present','absent','late','excused')),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, date)
);

-- ── Grades (legacy component) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id          UUID NOT NULL REFERENCES terms(id)    ON DELETE CASCADE,
  class_assignment NUMERIC(6,2),
  test_score       NUMERIC(6,2),
  exam_score       NUMERIC(6,2),
  recorded_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, subject_id, term_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_school  ON attendance(school_id, class_id, date);
CREATE INDEX IF NOT EXISTS idx_grades_school      ON grades(school_id, student_id);
