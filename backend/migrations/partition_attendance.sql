-- Attendance Table Partitioning
-- ============================================================
-- Run this during a MAINTENANCE WINDOW before the table exceeds ~10M rows.
-- Recommended timing: before reaching 30-40 schools in production.
--
-- Strategy: RANGE partition by date (year granularity).
-- The query planner prunes partitions automatically when queries
-- include WHERE date BETWEEN ... (which all term-scoped queries do).
--
-- Steps:
--   1. Create partitioned table with same structure
--   2. Copy data (can take minutes on large tables)
--   3. Swap names
--   4. Verify, then drop old table
--
-- IMPORTANT: take a full database backup before running this.
-- ============================================================

BEGIN;

-- Step 1: Create the partitioned table
CREATE TABLE attendance_partitioned (
  id          UUID NOT NULL DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL,
  student_id  UUID NOT NULL,
  class_id    UUID NOT NULL,
  date        DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'present'
                CHECK (status IN ('present','absent','late','excused')),
  recorded_by UUID,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, student_id, date)  -- enforced per partition
) PARTITION BY RANGE (date);

-- Step 2: Create yearly partitions (add more as needed each year)
CREATE TABLE attendance_2023 PARTITION OF attendance_partitioned
  FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');

CREATE TABLE attendance_2024 PARTITION OF attendance_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE attendance_2025 PARTITION OF attendance_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE attendance_2026 PARTITION OF attendance_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE attendance_2027 PARTITION OF attendance_partitioned
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

-- Default partition catches rows outside declared ranges (prevents insert failures)
CREATE TABLE attendance_default PARTITION OF attendance_partitioned DEFAULT;

-- Indexes on each partition (Postgres propagates these automatically in PG 11+)
CREATE INDEX ON attendance_partitioned (school_id, date);
CREATE INDEX ON attendance_partitioned (student_id);
CREATE INDEX ON attendance_partitioned (class_id, date);

-- Step 3: Copy existing data
INSERT INTO attendance_partitioned SELECT * FROM attendance;

-- Step 4: Swap
ALTER TABLE attendance RENAME TO attendance_old;
ALTER TABLE attendance_partitioned RENAME TO attendance;

-- Step 5: Re-add foreign key constraints (partitioned tables don't inherit them)
ALTER TABLE attendance
  ADD CONSTRAINT attendance_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  ADD CONSTRAINT attendance_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  ADD CONSTRAINT attendance_class_id_fkey
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  ADD CONSTRAINT attendance_recorded_by_fkey
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;

-- Step 6 (after verifying all queries work correctly):
-- DROP TABLE attendance_old;

-- ── Adding future partitions ──────────────────────────────────────────────────
-- Run this each year (e.g. in a startup migration or admin script):
--
-- CREATE TABLE IF NOT EXISTS attendance_2028 PARTITION OF attendance
--   FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
