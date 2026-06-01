-- Multi-tenant School Management SaaS — v2
-- UUID primary keys throughout; school_id on every tenant table.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Schools ───────────────────────────────────────────────────────────────────
CREATE TABLE schools (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  code           TEXT UNIQUE NOT NULL,
  address        TEXT,
  phone          TEXT,
  email          TEXT,
  plan           TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','basic','premium')),
  trial_end_date DATE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('owner','teacher','accountant')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, email)
);

-- ── Terms ─────────────────────────────────────────────────────────────────────
CREATE TABLE terms (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE,
  end_date   DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Classes ───────────────────────────────────────────────────────────────────
CREATE TABLE classes (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  level     TEXT,
  order_num INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Families ──────────────────────────────────────────────────────────────────
CREATE TABLE families (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  guardian_name TEXT,
  phone         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Students ──────────────────────────────────────────────────────────────────
CREATE TABLE students (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  family_id    UUID REFERENCES families(id) ON DELETE SET NULL,
  class_id     UUID REFERENCES classes(id)  ON DELETE SET NULL,
  student_code TEXT,
  name         TEXT NOT NULL,
  dob          DATE,
  gender       TEXT CHECK (gender IN ('male','female')),
  parent_name  TEXT,
  parent_phone TEXT,
  address      TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active','inactive','graduated','transferred')),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_code)
);

-- ── Learner Profiles (inclusivity) ───────────────────────────────────────────
CREATE TABLE learner_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  SEN_flag       BOOLEAN NOT NULL DEFAULT false,
  gifted_flag    BOOLEAN NOT NULL DEFAULT false,
  learning_style TEXT,
  accommodation  TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Subjects ──────────────────────────────────────────────────────────────────
CREATE TABLE subjects (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ── Assessments (AfL / AaL / AoL engine) ─────────────────────────────────────
CREATE TABLE assessments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  subject_id    UUID REFERENCES subjects(id)           ON DELETE SET NULL,
  class_id      UUID REFERENCES classes(id)            ON DELETE SET NULL,
  term_id       UUID REFERENCES terms(id)              ON DELETE SET NULL,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('AfL','AaL','AoL')),
  format        TEXT,
  term          TEXT,
  academic_year TEXT,
  max_score     INT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Competency Benchmarks ─────────────────────────────────────────────────────
CREATE TABLE competency_benchmarks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  subject_id     UUID REFERENCES subjects(id)           ON DELETE SET NULL,
  name           TEXT NOT NULL,
  expected_level TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Assessment → Competency Mapping ──────────────────────────────────────────
CREATE TABLE assessment_competency_map (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES assessments(id)          ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competency_benchmarks(id) ON DELETE CASCADE,
  UNIQUE(assessment_id, competency_id)
);

-- ── Results ───────────────────────────────────────────────────────────────────
CREATE TABLE results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id)    ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id)   ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score_theory    NUMERIC(6,2),
  score_practical NUMERIC(6,2),
  total_score     NUMERIC(6,2),
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, assessment_id)
);

-- ── Diagnostic Results ────────────────────────────────────────────────────────
CREATE TABLE diagnostic_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id)             ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id)          ON DELETE CASCADE,
  competency_id UUID NOT NULL REFERENCES competency_benchmarks(id) ON DELETE CASCADE,
  level         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Feedback ──────────────────────────────────────────────────────────────────
CREATE TABLE feedback (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id)             ON DELETE CASCADE,
  assessment_id   UUID REFERENCES assessments(id)                   ON DELETE SET NULL,
  competency_id   UUID REFERENCES competency_benchmarks(id)         ON DELETE SET NULL,
  comment         TEXT,
  action_required TEXT,
  recorded_by     UUID REFERENCES users(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Self Assessments ──────────────────────────────────────────────────────────
CREATE TABLE self_assessments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES subjects(id)           ON DELETE SET NULL,
  reflection       TEXT,
  confidence_level TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Skills (Nkyimu) ───────────────────────────────────────────────────────────
CREATE TABLE skills (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

CREATE TABLE student_skills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  skill_id        UUID NOT NULL REFERENCES skills(id)    ON DELETE CASCADE,
  level           TEXT,
  evidence_source TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, skill_id)
);

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  subject_id  UUID REFERENCES subjects(id)            ON DELETE SET NULL,
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE project_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, student_id)
);

-- ── Rubrics ───────────────────────────────────────────────────────────────────
CREATE TABLE rubrics (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id)           ON DELETE SET NULL,
  title      TEXT NOT NULL,
  criteria   TEXT,
  levels     TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Project Scores ────────────────────────────────────────────────────────────
CREATE TABLE project_scores (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  rubric_id   UUID REFERENCES rubrics(id)             ON DELETE SET NULL,
  rubric_score INT,
  feedback    TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, student_id)
);

-- ── Portfolios ────────────────────────────────────────────────────────────────
CREATE TABLE portfolios (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  type       TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE portfolio_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id)               ON DELETE CASCADE,
  portfolio_id  UUID NOT NULL REFERENCES portfolios(id)            ON DELETE CASCADE,
  competency_id UUID REFERENCES competency_benchmarks(id)          ON DELETE SET NULL,
  title         TEXT NOT NULL,
  file_url      TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Remediation Flags ─────────────────────────────────────────────────────────
CREATE TABLE remediation_flags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id)               ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id)              ON DELETE CASCADE,
  competency_id UUID REFERENCES competency_benchmarks(id)          ON DELETE SET NULL,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','resolved')),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Fee Items ─────────────────────────────────────────────────────────────────
CREATE TABLE fee_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- ── Fee Structures ────────────────────────────────────────────────────────────
CREATE TABLE fee_structures (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  class_id      UUID REFERENCES classes(id)            ON DELETE SET NULL,
  term_id       UUID REFERENCES terms(id)              ON DELETE SET NULL,
  name          TEXT NOT NULL,
  total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  academic_year TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_structure_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  fee_item_id      UUID NOT NULL REFERENCES fee_items(id)      ON DELETE RESTRICT,
  amount           NUMERIC(10,2) NOT NULL,
  UNIQUE(fee_structure_id, fee_item_id)
);

-- ── Payment Plans ─────────────────────────────────────────────────────────────
CREATE TABLE payment_plans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id        UUID NOT NULL REFERENCES schools(id)         ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id)        ON DELETE CASCADE,
  fee_structure_id UUID REFERENCES fee_structures(id)           ON DELETE SET NULL,
  term_id          UUID REFERENCES terms(id)                    ON DELETE SET NULL,
  plan_type        TEXT NOT NULL CHECK (plan_type IN ('full','50_50','60_40','weekly','monthly')),
  total_amount     NUMERIC(10,2) NOT NULL,
  start_date       DATE NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, term_id)
);

-- ── Payment Schedules ─────────────────────────────────────────────────────────
CREATE TABLE payment_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id)       ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id)      ON DELETE CASCADE,
  installment_num INT NOT NULL,
  due_date        DATE NOT NULL,
  amount_due      NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','paid','partial','overdue')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id      UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  plan_id        UUID REFERENCES payment_plans(id)       ON DELETE SET NULL,
  amount         NUMERIC(10,2) NOT NULL,
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  method         TEXT,
  reference      TEXT,
  receipt_number TEXT,
  notes          TEXT,
  recorded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Feeding Records ───────────────────────────────────────────────────────────
CREATE TABLE feeding_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
  class_id    UUID REFERENCES classes(id)             ON DELETE SET NULL,
  date        DATE NOT NULL,
  amount      NUMERIC(8,2) NOT NULL,
  recorded_by UUID REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_id, date)
);

-- ── Prospectus ────────────────────────────────────────────────────────────────
CREATE TABLE prospectus (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  item_name     TEXT NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL CHECK (plan IN ('trial','basic','premium')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  expiry_date DATE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Audit Logs ────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id)             ON DELETE SET NULL,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id UUID,
  meta      JSONB,
  ip        TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_school          ON users(school_id);
CREATE INDEX idx_terms_school          ON terms(school_id);
CREATE INDEX idx_classes_school        ON classes(school_id);
CREATE INDEX idx_families_school       ON families(school_id);
CREATE INDEX idx_students_school       ON students(school_id, status);
CREATE INDEX idx_students_family       ON students(family_id);
CREATE INDEX idx_students_class        ON students(class_id);
CREATE INDEX idx_learner_profiles      ON learner_profiles(student_id);
CREATE INDEX idx_subjects_school       ON subjects(school_id);
CREATE INDEX idx_assessments_school    ON assessments(school_id);
CREATE INDEX idx_assessments_class     ON assessments(class_id, term_id);
CREATE INDEX idx_competencies_school   ON competency_benchmarks(school_id);
CREATE INDEX idx_acmap_assessment      ON assessment_competency_map(assessment_id);
CREATE INDEX idx_results_school        ON results(school_id, student_id);
CREATE INDEX idx_results_assessment    ON results(assessment_id);
CREATE INDEX idx_diagnostic_student    ON diagnostic_results(school_id, student_id);
CREATE INDEX idx_feedback_student      ON feedback(school_id, student_id);
CREATE INDEX idx_self_assess_student   ON self_assessments(school_id, student_id);
CREATE INDEX idx_skills_school         ON skills(school_id);
CREATE INDEX idx_student_skills        ON student_skills(school_id, student_id);
CREATE INDEX idx_projects_school       ON projects(school_id);
CREATE INDEX idx_project_members       ON project_members(project_id);
CREATE INDEX idx_rubrics_school        ON rubrics(school_id);
CREATE INDEX idx_project_scores        ON project_scores(project_id);
CREATE INDEX idx_portfolios_student    ON portfolios(school_id, student_id);
CREATE INDEX idx_portfolio_items       ON portfolio_items(portfolio_id);
CREATE INDEX idx_remediation_student   ON remediation_flags(school_id, student_id);
CREATE INDEX idx_fee_items_school      ON fee_items(school_id);
CREATE INDEX idx_fee_structures_school ON fee_structures(school_id);
CREATE INDEX idx_fee_struct_items      ON fee_structure_items(fee_structure_id);
CREATE INDEX idx_payment_plans_school  ON payment_plans(school_id, student_id);
CREATE INDEX idx_payment_plans_term    ON payment_plans(school_id, term_id);
CREATE INDEX idx_payment_schedules     ON payment_schedules(plan_id, due_date);
CREATE INDEX idx_payments_school       ON payments(school_id, student_id);
CREATE INDEX idx_payments_plan         ON payments(plan_id);
CREATE INDEX idx_feeding_school        ON feeding_records(school_id, date);
CREATE INDEX idx_feeding_student       ON feeding_records(school_id, student_id);
CREATE INDEX idx_prospectus_school     ON prospectus(school_id, academic_year);
CREATE INDEX idx_subscriptions_school  ON subscriptions(school_id);
CREATE INDEX idx_audit_logs_school     ON audit_logs(school_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity     ON audit_logs(entity, entity_id);
