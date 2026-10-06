-- Durable invocation identity; independent of response expiry and terminal replies.
ALTER TABLE siyadah_chat_requests ADD COLUMN IF NOT EXISTS execution_identity_json jsonb;
