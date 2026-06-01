-- Add updated_at to attendance for offline conflict resolution.
-- Enables last-write-wins-by-timestamp: a sync'd offline record only wins
-- if its recorded_at is newer than what the server already has.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE attendance SET updated_at = created_at WHERE updated_at = NOW() AND created_at < NOW();
