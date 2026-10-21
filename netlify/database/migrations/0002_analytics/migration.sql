CREATE TABLE IF NOT EXISTS app_analytics (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (event_name IN ('page_view','project_view','signup','project_create','vote','ai_evaluation')),
  route TEXT NOT NULL DEFAULT '/',
  project_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_analytics_created_idx ON app_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS app_analytics_event_created_idx ON app_analytics(event_name,created_at DESC);
