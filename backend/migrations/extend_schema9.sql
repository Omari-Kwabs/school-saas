-- extend_schema9.sql
-- Restructures grades: class_score (50%) + exam_score (50%) = total (100%)
-- Adds teacher_name per subject record and terminal remarks table
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema9.sql','utf8')).then(()=>process.exit(0))"

-- ── Restructure grades table ──────────────────────────────────────────────────
ALTER TABLE grades DROP COLUMN IF EXISTS class_assignment;
ALTER TABLE grades DROP COLUMN IF EXISTS test_score;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS class_score NUMERIC(6,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(100);

-- ── Terminal remarks per student per term ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_terminal_remarks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id            UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_id              UUID NOT NULL REFERENCES terms(id)    ON DELETE CASCADE,
  interest             VARCHAR(200),
  conduct              VARCHAR(200),
  attitude             VARCHAR(200),
  class_teacher_remark TEXT,
  academic_remark      TEXT,
  recorded_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_terminal_remarks_school
  ON student_terminal_remarks(school_id, student_id);
