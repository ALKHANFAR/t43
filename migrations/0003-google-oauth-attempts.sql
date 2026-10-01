-- Additive, short-lived Google OAuth attempt ledger. The migration command creates
-- the same table through createGoogleOAuthAttemptStore.init() in one transaction.
CREATE TABLE IF NOT EXISTS siyadah_google_oauth_attempts (
  state_hash text PRIMARY KEY,
  company_id text NOT NULL,
  session_hash text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS siyadah_google_oauth_attempts_expiry_idx
  ON siyadah_google_oauth_attempts (expires_at);
