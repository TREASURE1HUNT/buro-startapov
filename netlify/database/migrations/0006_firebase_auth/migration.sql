ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_firebase_uid_idx ON app_accounts(firebase_uid) WHERE firebase_uid IS NOT NULL;
