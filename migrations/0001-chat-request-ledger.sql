CREATE TABLE IF NOT EXISTS siyadah_chat_requests (
  company_id varchar(128) NOT NULL,
  request_id varchar(80) NOT NULL,
  conversation_id varchar(80) NOT NULL,
  request_hash char(64) NOT NULL,
  claim_token char(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','unknown')),
  http_status integer,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (company_id,request_id)
);

-- A previously tested local ledger may exist without a request fingerprint.
-- Existing entries remain unreadable by a duplicate message, which is safer than re-execution.
ALTER TABLE siyadah_chat_requests ADD COLUMN IF NOT EXISTS request_hash char(64);
ALTER TABLE siyadah_chat_requests ADD COLUMN IF NOT EXISTS claim_token char(64);
