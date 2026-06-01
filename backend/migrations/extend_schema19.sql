-- extend_schema19: Add department membership to users
-- Allows department_head scoping: head sees all teachers in their department.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);
