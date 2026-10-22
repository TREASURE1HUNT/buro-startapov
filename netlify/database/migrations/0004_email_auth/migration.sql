ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
UPDATE app_accounts SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS app_auth_challenges (
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, purpose)
);

CREATE TABLE IF NOT EXISTS app_trusted_devices (
  email TEXT NOT NULL REFERENCES app_accounts(email) ON DELETE CASCADE ON UPDATE CASCADE,
  device_hash TEXT NOT NULL,
  device_label TEXT NOT NULL DEFAULT 'Browser',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, device_hash)
);
