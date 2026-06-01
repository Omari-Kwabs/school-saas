-- Branding fields for schools: logo, motto, theme colour
ALTER TABLE schools ADD COLUMN IF NOT EXISTS logo_url      TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS motto         TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#4f46e5';
