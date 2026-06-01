-- School calendar events (term dates, holidays, school events)
CREATE TABLE IF NOT EXISTS school_events (
  id          SERIAL PRIMARY KEY,
  school_id   INT  NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  event_type  VARCHAR(30)  NOT NULL
                CHECK (event_type IN ('term_start','term_end','holiday','event','exam')),
  start_date  DATE NOT NULL,
  end_date    DATE,
  created_by  INT  REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_events_school_date
  ON school_events(school_id, start_date);
