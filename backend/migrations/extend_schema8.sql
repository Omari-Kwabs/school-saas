-- ── Academic outcomes (promotions, repeats, graduations, transfers) ───────────
-- Tracks every end-of-term decision made for a student.
-- repeat_count on students gives a quick running total without querying history.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS repeat_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS student_academic_outcomes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  term_id        UUID NOT NULL REFERENCES terms(id)     ON DELETE CASCADE,
  outcome        TEXT NOT NULL
                   CHECK (outcome IN ('promoted','repeated','graduated','transferred')),
  from_class_id  UUID REFERENCES classes(id) ON DELETE SET NULL,
  to_class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
  notes          TEXT,
  recorded_by    UUID REFERENCES users(id)   ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),

  -- One outcome decision per student per term
  UNIQUE (school_id, student_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_student
  ON student_academic_outcomes(student_id);

CREATE INDEX IF NOT EXISTS idx_outcomes_school_term
  ON student_academic_outcomes(school_id, term_id);
