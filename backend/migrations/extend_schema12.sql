-- extend_schema12.sql
-- Feature flags: enable/disable features per school without a deploy.
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema12.sql','utf8')).then(()=>process.exit(0))"

CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL = global flag (applies to all schools)
  flag_name   TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, flag_name)
);

-- Partial unique index for global flags (school_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_global
  ON feature_flags (flag_name) WHERE school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_feature_flags_school
  ON feature_flags (school_id, flag_name);
