# Siyadah schema release

Railway runs `node scripts/migrate-schema.mjs` from `railway.json` after building the image and before starting the new application. It requires `DATABASE_URL` in the service environment. The command uses one PostgreSQL transaction, bounded lock and statement waits, and a database advisory lock. A failed command exits nonzero and rolls back the transaction; the deployment must not proceed.

The application does not run schema initialization while serving requests. `/health` checks required tables, columns, and the chat ledger primary key using read-only queries. When migration `0002-local-employee-drafts.sql` is included in the deployed image, it also checks the local-draft columns, nullable flow reference, and unique request index. It returns 503 if the schema required by that image is incomplete.

The current migration is additive: it creates missing tables and columns. The old application must be able to keep serving while the pre-deploy command runs. Review new migrations for that compatibility before adding them to this command. A Railway application rollback does not undo a committed database migration; never drop a table as an automatic rollback.

The integrated draft branch adds `siyadah_google_oauth_attempts` through the pre-deploy migration. It stores only hashes of the OAuth state and session binding, plus company ID and expiry. Callback consumption deletes the matching row atomically. The new image's `/health` rejects a database where that table is missing. This is local code readiness, not evidence of a configured Google client or successful provider connection.

Migration `0005-activepieces-mcp.sql` adds project MCP grants and short-lived approvals. The grant's refresh token and approval arguments are encrypted in the server before storage. It is additive to the existing customer and Activepieces data; `/health` checks both new tables before serving the new chat path.

Before merging into Railway's connected branch, confirm the production project, environment, service, GitHub trigger, pre-deploy command resolved from this file, database catalog, and an available restore point. The connected branch can deploy automatically without waiting for GitHub checks. Test the migration against a new and a representative existing PostgreSQL database, then verify `/health` returns 503 before and 200 after migration without any DDL in the health path.
