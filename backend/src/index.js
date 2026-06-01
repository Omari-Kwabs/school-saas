require('dotenv').config();
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}

const express    = require('express');
const http       = require('http');
const { Server: SocketIO } = require('socket.io');
const cors       = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const auth         = require('./middleware/auth');
const tenant       = require('./middleware/tenant');
const csrfOriginGuard = require('./middleware/csrf');
const requirePlan  = require('./middleware/requirePlan');
const notify       = require('./lib/notify');
const jwt          = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET is too short (minimum 32 characters). Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const app    = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

// Allow any private-network IP in development only (for phones on the same LAN)
function isPrivateNetworkOrigin(origin) {
  if (process.env.NODE_ENV === 'production') return false;
  return /^https?:\/\/(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(origin);
}

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(cookieParser());
app.use(express.json());
app.use(csrfOriginGuard);

// ── Socket.io: attach to HTTP server, authenticate via JWT, join school room ──
// TODO (multi-process scale): add Redis adapter before running 2+ server processes.
// When needed:
//   const { createAdapter } = require('@socket.io/redis-adapter');
//   const pub = new (require('ioredis'))(process.env.REDIS_URL);
//   io.adapter(createAdapter(pub, pub.duplicate()));
// ioredis is already installed. This is a one-afternoon job.
const io = new SocketIO(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || isPrivateNetworkOrigin(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});
io.use((socket, next) => {
  // Read token from cookie (set by httpOnly cookie on login) or Authorization header
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookieMatch = cookieHeader.match(/auth_token=([^;]+)/);
  const token = (cookieMatch ? cookieMatch[1] : null)
    || socket.handshake.auth?.token
    || socket.handshake.headers?.authorization?.slice(7);
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});
io.on('connection', socket => {
  const { school_id, role } = socket.user;
  if (school_id && role !== 'system_admin') {
    socket.join(`school:${school_id}`);
  }
  socket.on('disconnect', () => {});
});
notify.init(io);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use(globalLimiter);

// Public health check — no auth required (for UptimeRobot, BetterStack, load balancers)
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Public
app.use('/api/auth', authLimiter, require('./routes/auth'));

// All routes below require a valid JWT and an active school
app.use(auth, tenant);

// Per-school rate limiting (keyed by school_id, not IP)
app.use(require('./middleware/schoolRateLimit'));

// Core entities
app.use('/api/students',         require('./routes/students'));
app.use('/api/classes',          require('./routes/classes'));
app.use('/api/subjects',         require('./routes/subjects'));
app.use('/api/terms',            require('./routes/terms'));
app.use('/api/families',         require('./routes/families'));

// Learner profiles + skills
app.use('/api/learner-profiles', require('./routes/learner-profiles'));
app.use('/api/skills',           require('./routes/skills'));

// Academic framework
app.use('/api/competencies',     require('./routes/competencies'));
app.use('/api/assessments',      require('./routes/assessments'));
app.use('/api/rubrics',          require('./routes/rubrics'));

// Academic records
app.use('/api/approvals',        require('./routes/approvals'));
app.use('/api/grades',           require('./routes/grades'));
app.use('/api/results',          require('./routes/results'));
app.use('/api/diagnosis',        require('./routes/diagnosis'));
app.use('/api/feedback',         require('./routes/feedback'));
app.use('/api/self-assessments', require('./routes/self-assessments'));
app.use('/api/projects',         require('./routes/projects'));
app.use('/api/portfolios',       require('./routes/portfolios'));
app.use('/api/remediation',      require('./routes/remediation'));
app.use('/api/report-card',      require('./routes/report-card'));
app.use('/api/intelligence',     requirePlan('premium'), require('./routes/intelligence'));

// Finance
app.use('/api/fee-structures',   require('./routes/fee-structures'));
app.use('/api/payments',         require('./routes/payments'));
app.use('/api/expenses',         require('./routes/expenses'));
app.use('/api/deletion-requests', require('./routes/deletion-requests'));
app.use('/api/subscriptions',    require('./routes/subscriptions'));
app.use('/api/prospectus',       require('./routes/prospectus'));

// Operations
app.use('/api/attendance',       require('./routes/attendance'));
app.use('/api/discounts',        require('./routes/discounts'));
app.use('/api/feeding',          require('./routes/feeding'));
app.use('/api/users',            require('./routes/users'));
app.use('/api/audit',            require('./routes/audit'));

// Extended schema
app.use('/api/classifications',      require('./routes/classifications'));
app.use('/api/departments',          require('./routes/departments'));
app.use('/api/store',                require('./routes/store'));
app.use('/api/teaching-assignments', require('./routes/teaching-assignments'));

// System admin — requires system_admin role, bypasses tenant middleware
app.use('/api/admin',                require('./routes/admin'));

// New modules
app.use('/api/timetable',            require('./routes/timetable'));
app.use('/api/announcements',        require('./routes/announcements'));
app.use('/api/memos',                require('./routes/memos'));
app.use('/api/profile',              require('./routes/profile'));
app.use('/api/roles',                require('./routes/roles'));
app.use('/api/teacher-performance', requirePlan('premium'), require('./routes/teacher-performance'));
app.use('/api/stats',               require('./routes/stats'));
app.use('/api/school/branding',     require('./routes/school-branding'));
app.use('/api/calendar',            require('./routes/calendar'));
app.use('/api/uploads',             require('./routes/uploads'));

// Sentry error handler must come after routes and before any custom error middleware
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Generic error handler — catches anything thrown in routes
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' && status >= 500
    ? 'Internal server error'
    : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// Export for supertest (tests import app without starting the server)
module.exports = app;

const pool = require('./config/db');

const PORT = process.env.PORT || 5001;

// Only run migrations and start server when executed directly (not required by tests)
if (require.main === module) {

pool.query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_data TEXT;
`).catch(err => console.error('signature_data migration failed:', err.message));

pool.query(`
  CREATE TABLE IF NOT EXISTS plan_pricing (
    plan       VARCHAR(20) PRIMARY KEY CHECK (plan IN ('trial', 'basic', 'premium')),
    price_ghs  NUMERIC(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  INSERT INTO plan_pricing (plan, price_ghs) VALUES
    ('trial',    0.00),
    ('basic',  500.00),
    ('premium', 1500.00)
  ON CONFLICT (plan) DO NOTHING;
`).catch(err => console.error('plan_pricing init failed:', err.message))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS school_events (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      title       VARCHAR(200) NOT NULL,
      description TEXT,
      event_type  VARCHAR(30) NOT NULL
                    CHECK (event_type IN ('term_start','term_end','holiday','event','exam')),
      start_date  DATE NOT NULL,
      end_date    DATE,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_school_events_school_date
      ON school_events(school_id, start_date);
  `).catch(err => console.error('school_events init failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS repeat_count INT NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS student_academic_outcomes (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id      UUID NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
      student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      term_id        UUID NOT NULL REFERENCES terms(id)    ON DELETE CASCADE,
      outcome        TEXT NOT NULL
                       CHECK (outcome IN ('promoted','repeated','graduated','transferred')),
      from_class_id  UUID REFERENCES classes(id) ON DELETE SET NULL,
      to_class_id    UUID REFERENCES classes(id) ON DELETE SET NULL,
      notes          TEXT,
      recorded_by    UUID REFERENCES users(id)  ON DELETE SET NULL,
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (school_id, student_id, term_id)
    );
    CREATE INDEX IF NOT EXISTS idx_outcomes_student
      ON student_academic_outcomes(student_id);
    CREATE INDEX IF NOT EXISTS idx_outcomes_school_term
      ON student_academic_outcomes(school_id, term_id);
  `).catch(err => console.error('academic_outcomes init failed:', err.message)))
  .then(() => pool.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
      ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_schedules_plan_due
      ON payment_schedules(plan_id, due_date);
  `).catch(err => console.error('index migration failed:', err.message)))
  .then(() => pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'document_approvals'
          AND column_name = 'school_id'
          AND data_type = 'integer'
      ) THEN
        DROP TABLE document_approvals;
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS document_approvals (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      document_type     VARCHAR(50) NOT NULL DEFAULT 'report_card',
      student_id        UUID REFERENCES students(id) ON DELETE CASCADE,
      student_name      VARCHAR(200),
      class_id          UUID REFERENCES classes(id) ON DELETE SET NULL,
      class_name        VARCHAR(100),
      term_id           UUID REFERENCES terms(id) ON DELETE CASCADE,
      term_name         VARCHAR(100),
      approval_tier     VARCHAR(50) NOT NULL,
      requested_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      requested_by_name VARCHAR(200),
      requested_at      TIMESTAMPTZ DEFAULT NOW(),
      approver_id       UUID REFERENCES users(id) ON DELETE SET NULL,
      approver_name     VARCHAR(200),
      approver_role     VARCHAR(50),
      signature_data    TEXT,
      status            VARCHAR(20) NOT NULL DEFAULT 'pending',
      approved_at       TIMESTAMPTZ,
      UNIQUE (school_id, document_type, student_id, term_id, approval_tier)
    );
    CREATE INDEX IF NOT EXISTS idx_document_approvals_school
      ON document_approvals(school_id, status, approval_tier);
    CREATE INDEX IF NOT EXISTS idx_document_approvals_student_term
      ON document_approvals(student_id, term_id);
  `).catch(err => console.error('document_approvals init failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_users_id_token_version ON users(id, token_version);
  `).catch(err => console.error('token_version migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS feature_flags (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
      flag_name   TEXT NOT NULL,
      enabled     BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (school_id, flag_name)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_global
      ON feature_flags (flag_name) WHERE school_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_feature_flags_school
      ON feature_flags (school_id, flag_name);
  `).catch(err => console.error('feature_flags migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS generated_reports (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,
      term_id      UUID REFERENCES terms(id) ON DELETE SET NULL,
      requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
      status       VARCHAR(20) NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','processing','completed','failed')),
      result_html  TEXT,
      error_message TEXT,
      queued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at   TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_generated_reports_school
      ON generated_reports(school_id, status, queued_at DESC);
  `).catch(err => console.error('generated_reports migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
  `).catch(err => console.error('attendance updated_at migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('simple',
            coalesce(name, '') || ' ' || coalesce(student_code, '')
          )
        ) STORED;
    CREATE INDEX IF NOT EXISTS idx_students_search ON students USING gin(search_vector);
  `).catch(err => console.error('students search_vector migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE classes
      ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS class_fee  NUMERIC(12,2) NOT NULL DEFAULT 0;
  `).catch(err => console.error('classes special fee migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
    UPDATE users SET username = email WHERE username IS NULL;
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_school_username ON users(school_id, username);
  `).catch(err => console.error('users username migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS blood_group               VARCHAR(5),
      ADD COLUMN IF NOT EXISTS allergies                 TEXT,
      ADD COLUMN IF NOT EXISTS medical_conditions        TEXT,
      ADD COLUMN IF NOT EXISTS emergency_contact_name    VARCHAR(200),
      ADD COLUMN IF NOT EXISTS emergency_contact_phone   VARCHAR(30),
      ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS parent2_name              VARCHAR(200),
      ADD COLUMN IF NOT EXISTS parent2_phone             VARCHAR(30),
      ADD COLUMN IF NOT EXISTS parent_email              VARCHAR(200),
      ADD COLUMN IF NOT EXISTS nationality               VARCHAR(100),
      ADD COLUMN IF NOT EXISTS religion                  VARCHAR(100),
      ADD COLUMN IF NOT EXISTS admission_date            DATE;
  `).catch(err => console.error('students emergency fields migration failed:', err.message)))
  .then(() => pool.query(`
    INSERT INTO role_privileges (role_id, privilege)
    SELECT sr.id, 'calendar:manage'
    FROM school_roles sr
    WHERE sr.name IN ('owner','headmaster_academics','headmaster_admin')
      AND NOT EXISTS (
        SELECT 1 FROM role_privileges rp
        WHERE rp.role_id = sr.id AND rp.privilege = 'calendar:manage'
      );
  `).catch(err => console.error('calendar:manage privilege seed failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE terms
      ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9),
      ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE terms SET academic_year =
      CASE WHEN EXTRACT(MONTH FROM start_date) >= 9
        THEN EXTRACT(YEAR FROM start_date)::text || '/' || (EXTRACT(YEAR FROM start_date)+1)::text
        ELSE (EXTRACT(YEAR FROM start_date)-1)::text || '/' || EXTRACT(YEAR FROM start_date)::text
      END
    WHERE academic_year IS NULL AND start_date IS NOT NULL;
  `).catch(err => console.error('terms archive migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON payments(plan_id) WHERE plan_id IS NOT NULL;
  `).catch(err => console.error('payments plan_id index migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS student_counter INTEGER NOT NULL DEFAULT 0;
    UPDATE schools s SET student_counter = (
      SELECT COUNT(*) FROM students st WHERE st.school_id = s.id
    ) WHERE student_counter = 0;
  `).catch(err => console.error('schools student_counter migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS fee_carry_forwards (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      from_term_id UUID REFERENCES terms(id) ON DELETE SET NULL,
      to_term_id   UUID REFERENCES terms(id) ON DELETE SET NULL,
      amount       NUMERIC(10,2) NOT NULL,
      notes        TEXT,
      created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(school_id, student_id, from_term_id)
    );
    CREATE INDEX IF NOT EXISTS idx_carry_forwards_student ON fee_carry_forwards(school_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_carry_forwards_to_term ON fee_carry_forwards(school_id, to_term_id);
  `).catch(err => console.error('fee_carry_forwards migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      receipt_number VARCHAR(50) NOT NULL,
      category       VARCHAR(100) NOT NULL,
      description    TEXT NOT NULL,
      amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
      expense_date   DATE NOT NULL,
      paid_to        VARCHAR(200),
      notes          TEXT,
      created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(school_id, receipt_number)
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_school_date     ON expenses(school_id, expense_date DESC);
    CREATE INDEX IF NOT EXISTS idx_expenses_school_category ON expenses(school_id, category);
  `).catch(err => console.error('expenses migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE school_events
      ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES terms(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_school_events_term_type
      ON school_events(school_id, term_id, event_type)
      WHERE term_id IS NOT NULL;
    ALTER TABLE fee_structures
      ADD COLUMN IF NOT EXISTS fee_due_date DATE,
      ADD COLUMN IF NOT EXISTS academic_year VARCHAR(9);
    UPDATE fee_structures fs
       SET academic_year = t.academic_year
      FROM terms t
     WHERE fs.term_id = t.id AND fs.academic_year IS NULL;
  `).catch(err => console.error('term_calendar_feestructure migration failed:', err.message)))
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS financial_period_balances (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      period_key      VARCHAR(20) NOT NULL,
      opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes           TEXT,
      updated_by      UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(school_id, period_key)
    );
    CREATE INDEX IF NOT EXISTS idx_fpb_school ON financial_period_balances(school_id, period_key);
  `).catch(err => console.error('financial_period_balances migration failed:', err.message)))
  .then(() => pool.query(`
    ALTER TABLE classes        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE expenses       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE announcements  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP, ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS deletion_requests (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      entity_type     VARCHAR(50) NOT NULL,
      entity_id       UUID NOT NULL,
      entity_name     VARCHAR(500) NOT NULL,
      entity_snapshot JSONB NOT NULL,
      requested_by    UUID REFERENCES users(id) ON DELETE SET NULL,
      requested_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      reason          TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
      reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at     TIMESTAMP,
      review_notes    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_deletion_requests_school
      ON deletion_requests(school_id, status, requested_at DESC);
  `).catch(err => console.error('soft_delete migration failed:', err.message)))
  .then(() => pool.query(`
    INSERT INTO school_events (school_id, title, event_type, start_date, term_id, created_by)
    SELECT t.school_id,
           t.name || ' Begins',
           'term_start',
           t.start_date,
           t.id,
           (SELECT id FROM users WHERE school_id = t.school_id AND role = 'owner' LIMIT 1)
    FROM terms t
    WHERE t.start_date IS NOT NULL
      AND t.end_date   IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM school_events se
        WHERE se.term_id = t.id AND se.event_type = 'term_start'
      )
    ON CONFLICT DO NOTHING;

    INSERT INTO school_events (school_id, title, event_type, start_date, term_id, created_by)
    SELECT t.school_id,
           t.name || ' Ends',
           'term_end',
           t.end_date,
           t.id,
           (SELECT id FROM users WHERE school_id = t.school_id AND role = 'owner' LIMIT 1)
    FROM terms t
    WHERE t.start_date IS NOT NULL
      AND t.end_date   IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM school_events se
        WHERE se.term_id = t.id AND se.event_type = 'term_end'
      )
    ON CONFLICT DO NOTHING;
  `).catch(err => console.error('term events backfill failed:', err.message)))
  .then(() => {
    if (process.env.REDIS_URL) {
      require('./jobs/workers/reportWorker');
      require('./jobs/workers/refreshViewsWorker');
      require('./jobs/workers/auditPurgeWorker');
      if (process.env.R2_ACCESS_KEY_ID) {
        require('./jobs/workers/backupWorker');
      }
      console.log('Background workers started');
    }
  })
  .then(() => server.listen(PORT, () => console.log(`Server running on port ${PORT}`)));
}
