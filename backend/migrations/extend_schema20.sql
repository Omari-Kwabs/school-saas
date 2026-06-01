-- extend_schema20: Performance indexes for high-frequency query paths

-- results: lookup by assessment (used in bulk score entry and grade compute)
CREATE INDEX IF NOT EXISTS idx_results_assessment_school
  ON results(assessment_id, school_id);

-- results: lookup by student+school (student result history)
CREATE INDEX IF NOT EXISTS idx_results_student_school
  ON results(student_id, school_id);

-- assessments: the primary filter used by grade compute and scores tab
CREATE INDEX IF NOT EXISTS idx_assessments_class_subject_term
  ON assessments(school_id, class_id, subject_id, term_id);

-- teaching_assignments: scoped-role teacher queries (called per request)
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_teacher
  ON teaching_assignments(teacher_id, school_id);

-- grades: lookup by student+subject+term (report card, grade compute conflict check)
CREATE INDEX IF NOT EXISTS idx_grades_student_subject_term
  ON grades(student_id, subject_id, term_id, school_id);

-- grades: lookup by subject+term for class-level grade views
CREATE INDEX IF NOT EXISTS idx_grades_subject_term
  ON grades(subject_id, term_id, school_id);

-- student_terminal_remarks: lookup by student+term
CREATE INDEX IF NOT EXISTS idx_terminal_remarks_student_term
  ON student_terminal_remarks(student_id, term_id, school_id);
