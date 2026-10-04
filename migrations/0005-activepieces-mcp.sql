-- One project-scoped MCP grant per Siyadah company. The refresh token is
-- encrypted before storage; provider connection secrets remain in Activepieces.
CREATE TABLE IF NOT EXISTS siyadah_mcp_grants (
  tenant_id varchar(128) PRIMARY KEY REFERENCES siyadah_tenant_projects(tenant_id),
  project_id varchar(21) NOT NULL UNIQUE,
  client_id text NOT NULL,
  refresh_token_cipher text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS siyadah_mcp_approvals (
  id uuid PRIMARY KEY,
  tenant_id varchar(128) NOT NULL REFERENCES siyadah_tenant_projects(tenant_id),
  conversation_id varchar(128) NOT NULL,
  employee_id uuid,
  tool_name varchar(100) NOT NULL,
  args_cipher text NOT NULL,
  summary text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS siyadah_mcp_approvals_expiry_idx ON siyadah_mcp_approvals(expires_at);
