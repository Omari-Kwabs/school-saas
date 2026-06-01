-- extend_schema17.sql
-- Introduces four explicit assessment types and a 3-component grade breakdown:
--   Types:  classwork | homework | class_test | exam
--   Weights: classwork + homework → 20%
--            class_test           → 20%
--            exam                 → 60%
--            total                  100%
--
-- class_score (was /50) now stores classwork_score + class_test_score (max 40).
-- exam_score  (was /50) now stores exam result scaled to 60 (max 60).
-- classwork_score and class_test_score are stored separately for report card breakdown.
--
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema17.sql','utf8')).then(()=>process.exit(0))"

-- ── Assessment types ─────────────────────────────────────────────────────────
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_type_check;
ALTER TABLE assessments ADD CONSTRAINT assessments_type_check
  CHECK (type IN ('classwork','homework','class_test','exam','AfL','AaL','AoL'));

-- ── Grade breakdown columns ───────────────────────────────────────────────────
ALTER TABLE grades ADD COLUMN IF NOT EXISTS classwork_score  NUMERIC(6,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS class_test_score NUMERIC(6,2);
-- class_score  now represents classwork_score + class_test_score  (max 40)
-- exam_score   now represents exam result scaled to 60            (max 60)
-- total = class_score + exam_score = 100
