-- Run this migration once to enable admin-settable plan pricing in GHS

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
