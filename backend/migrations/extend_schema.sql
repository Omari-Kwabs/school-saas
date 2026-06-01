-- extend_schema.sql
-- Run ONCE against the existing database:
--   psql $DATABASE_URL -f backend/migrations/extend_schema.sql

-- ── 1. Extended user roles ────────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'owner',
    'teacher',
    'accountant',
    'bursar',
    'headmaster_academics',
    'headmaster_admin',
    'department_head',
    'class_teacher'
  ));

-- ── 2. Classifications (e.g. Primary, JHS) ────────────────────────────────
CREATE TABLE IF NOT EXISTS classifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  head_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

ALTER TABLE classes ADD COLUMN IF NOT EXISTS classification_id UUID REFERENCES classifications(id) ON DELETE SET NULL;

-- ── 3. Departments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  head_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ── 4. Teaching Assignments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teaching_assignments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id    UUID REFERENCES terms(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, teacher_id, class_id, subject_id)
);

-- ── 5. Store Items ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id           UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  quantity            INT NOT NULL DEFAULT 0,
  unit                TEXT,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ── 6. Store Transactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_transactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES users(id),
  quantity    INT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('issue','restock')),
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 7. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_classifications_school  ON classifications(school_id);
CREATE INDEX IF NOT EXISTS idx_departments_school      ON departments(school_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assign_school  ON teaching_assignments(school_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_store_items_school      ON store_items(school_id);
CREATE INDEX IF NOT EXISTS idx_store_tx_school         ON store_transactions(school_id, item_id);
