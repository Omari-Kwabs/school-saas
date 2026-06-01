-- extend_schema2.sql
-- Run ONCE:  psql $DATABASE_URL -f backend/migrations/extend_schema2.sql

-- ── Timetable slots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  term_id     UUID REFERENCES terms(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 4), -- 0=Mon 4=Fri
  period_num  SMALLINT NOT NULL,
  start_time  TIME,
  end_time    TIME,
  label       TEXT,  -- free-text override (e.g. "Break", "Assembly")
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_id, term_id, day_of_week, period_num)
);

-- ── Announcements / Noticeboard ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  posted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  audience    VARCHAR(20) NOT NULL DEFAULT 'all'
                CHECK (audience IN ('all','staff','students')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_timetable_school  ON timetable_slots(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_announce_school   ON announcements(school_id, is_active);
