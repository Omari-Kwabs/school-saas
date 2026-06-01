-- Audit Logs Table Partitioning
-- ============================================================
-- Run this during a MAINTENANCE WINDOW before the table exceeds ~20M rows.
-- audit_logs grows fastest (every write operation appended).
--
-- Strategy: RANGE partition by created_at (monthly granularity).
-- Monthly partitions allow easy archival: detach a partition, dump it
-- to cold storage, then drop it — without a DELETE on the main table.
--
-- IMPORTANT: take a full database backup before running this.
-- ============================================================

BEGIN;

CREATE TABLE audit_logs_partitioned (
  id         UUID NOT NULL DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL,
  user_id    UUID,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  UUID,
  meta       JSONB,
  ip         TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Monthly partitions for 2025–2027 (extend as needed)
CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE audit_logs_2025_02 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE audit_logs_2025_03 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE audit_logs_2025_04 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE audit_logs_2025_05 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE audit_logs_2025_06 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE audit_logs_2025_07 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE audit_logs_2025_08 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE audit_logs_2025_09 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE audit_logs_2025_10 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE audit_logs_2026_08 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_10 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE audit_logs_2026_11 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE audit_logs_2026_12 PARTITION OF audit_logs_partitioned FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Default partition catches rows outside declared ranges
CREATE TABLE audit_logs_default PARTITION OF audit_logs_partitioned DEFAULT;

-- Indexes
CREATE INDEX ON audit_logs_partitioned (school_id, created_at DESC);
CREATE INDEX ON audit_logs_partitioned (user_id);

-- Copy data
INSERT INTO audit_logs_partitioned SELECT * FROM audit_logs;

-- Swap
ALTER TABLE audit_logs RENAME TO audit_logs_old;
ALTER TABLE audit_logs_partitioned RENAME TO audit_logs;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
  ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;

-- After verifying: DROP TABLE audit_logs_old;

-- ── Cold-archive a month (run annually for old partitions) ───────────────────
-- 1. pg_dump the partition to a file, upload to R2:
--      pg_dump $DATABASE_URL -t audit_logs_2025_01 | gzip > audit_logs_2025_01.sql.gz
-- 2. Detach and drop:
--      ALTER TABLE audit_logs DETACH PARTITION audit_logs_2025_01;
--      DROP TABLE audit_logs_2025_01;
--
-- ── Adding future monthly partitions (run each month) ───────────────────────
-- CREATE TABLE IF NOT EXISTS audit_logs_2028_01 PARTITION OF audit_logs
--   FOR VALUES FROM ('2028-01-01') TO ('2028-02-01');
