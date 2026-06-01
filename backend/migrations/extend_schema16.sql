-- extend_schema16.sql
-- Extends assessment types to include homework, class_test, and exam.
-- These feed the grade computation engine:
--   • Class work (AoL, AfL, AaL, homework): best 5 → 30 marks
--   • Class tests (class_test):              best 2 → 20 marks
--   • Exam (exam):                           single  → 50 marks
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema16.sql','utf8')).then(()=>process.exit(0))"

ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_type_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_type_check
  CHECK (type IN ('AfL','AaL','AoL','homework','class_test','exam'));

-- Supporting index for grade computation queries
CREATE INDEX IF NOT EXISTS idx_assessments_subject_class_term
  ON assessments(school_id, subject_id, class_id, term_id);

CREATE INDEX IF NOT EXISTS idx_results_student_assessment
  ON results(school_id, student_id, assessment_id);
