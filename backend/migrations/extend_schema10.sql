-- extend_schema10.sql
-- JWT token versioning: increment token_version to invalidate sessions on role/privilege change.
-- Run ONCE: node -e "require('./src/config/db').query(require('fs').readFileSync('./migrations/extend_schema10.sql','utf8')).then(()=>process.exit(0))"

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_id_token_version ON users(id, token_version);
