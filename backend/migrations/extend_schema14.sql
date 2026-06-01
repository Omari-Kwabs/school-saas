-- Full-text search for students using a generated tsvector column + GIN index.
-- Replaces ILIKE '%query%' (full table scan) with an index-backed prefix search.
-- Uses the 'simple' dictionary so short names like 'Ali' are not stripped as stop-words.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('simple',
        coalesce(name, '') || ' ' || coalesce(student_code, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_students_search
  ON students USING gin(search_vector);
