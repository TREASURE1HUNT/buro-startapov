CREATE TABLE IF NOT EXISTS app_accounts (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('startup', 'investor', 'mentor')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_scheme TEXT NOT NULL DEFAULT 'scrypt',
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL REFERENCES app_accounts(email) ON DELETE CASCADE ON UPDATE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_projects (
  id TEXT PRIMARY KEY,
  owner_email TEXT NOT NULL REFERENCES app_accounts(email) ON DELETE CASCADE ON UPDATE CASCADE,
  document JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_projects_updated_idx ON app_projects(updated_at DESC);

CREATE TABLE IF NOT EXISTS app_votes (
  project_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, voter_key)
);

CREATE TABLE IF NOT EXISTS app_records (
  owner_email TEXT NOT NULL REFERENCES app_accounts(email) ON DELETE CASCADE ON UPDATE CASCADE,
  record_key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_email, record_key)
);
