ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS public_id TEXT;
UPDATE app_accounts SET public_id = md5(email || ':' || random()::text || ':' || clock_timestamp()::text) WHERE public_id IS NULL;
ALTER TABLE app_accounts ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE app_accounts ALTER COLUMN public_id SET DEFAULT md5(random()::text || ':' || clock_timestamp()::text);
CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_public_id_idx ON app_accounts(public_id);
