ALTER TABLE app_analytics ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS app_analytics_visitor_created_idx ON app_analytics(visitor_id, created_at DESC) WHERE visitor_id IS NOT NULL;
