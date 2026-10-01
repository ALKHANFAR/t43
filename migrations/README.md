# Siyadah schema release

Railway runs `node scripts/migrate-schema.mjs` from `railway.json` after building the image and before starting the new application. It requires `DATABASE_URL` in the service environment. The command uses one PostgreSQL transaction, bounded lock and statement waits, and a database advisory lock. A failed command exits nonzero and rolls back the transaction; the deployment must not proceed.

The application does not run schema initialization while serving requests. `/health` checks required tables, columns, and the chat ledger primary key using read-only queries. It returns 503 if the migration did not finish.

The current migration is additive: it creates missing tables and columns. The old application must be able to keep serving while the pre-deploy command runs. Review new migrations for that compatibility before adding them to this command. A Railway application rollback does not undo a committed database migration; never drop a table as an automatic rollback.

Before merging into Railway's connected branch, confirm the production project, environment, service, GitHub trigger, pre-deploy command resolved from this file, database catalog, and an available restore point. The connected branch can deploy automatically without waiting for GitHub checks. Test the migration against a new and a representative existing PostgreSQL database, then verify `/health` returns 503 before and 200 after migration without any DDL in the health path.
