-- extend_schema5.sql
-- Targeted announcements + Staff memos
-- Run ONCE: psql $DATABASE_URL -f backend/migrations/extend_schema5.sql

-- ── Extend announcements audience ─────────────────────────────────────────────
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_audience_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_audience_check
  CHECK (audience IN ('all','staff','students','teachers','heads'));

-- ── Memos (staff-to-staff internal memos) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS memos (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  from_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  subject    TEXT NOT NULL,
  body       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CC recipients per memo
CREATE TABLE IF NOT EXISTS memo_cc (
  memo_id UUID NOT NULL REFERENCES memos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (memo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memos_school_to   ON memos(school_id, to_id);
CREATE INDEX IF NOT EXISTS idx_memos_school_from ON memos(school_id, from_id);
