# Isolated native USER authentication probe (ABO-69)

This is a prepared QA probe, not a production authentication adapter or a completed live test. It leaves the existing OAuth grants and their storage untouched. It writes no database data and neither creates projects nor builds or executes Flows.

## Deferred operating-account check — 6 October 2026

The owner explicitly deferred activation and role changes for `d10ksa3@gmail.com` so other readiness work can continue. The last native platform UI readback showed `Pending / Operator`; the invitation-acceptance screenshot alone did not establish an activated account. Admin elevation and this account's live USER sign-in → project MCP issuance → tools/list test remain incomplete.

Before automatic customer onboarding is approved, confirm activation, review the operating account's permissions, configure its credentials through an approved secret store, and capture the probe's successful native receipt. This deferral does not waive company isolation or authorize a substitute authentication mechanism.

`scripts/native-user-auth-probe.mjs` reads `ACTIVEPIECES_OPERATOR_EMAIL` and `ACTIVEPIECES_OPERATOR_PASSWORD` only from its process environment. Store them through an approved secret store or sealed service settings, never in chat, command arguments, files or logs. The CLI accepts no arguments. With missing variables it emits `configuration / missing_config` and exits 2 before making any network request.

The origin is pinned to the current Railway Activepieces instance. The sole project allowlist entry is QA1 `rPMd07kp7x3epzOdvdiQJ`, verified in the read-only production evidence on 6 October 2026. Optional `SIYADAH_NATIVE_AUTH_QA_PROJECT_ID` may only select that verified project. The probe always obtains fresh native authentication; it accepts no supplied USER/MCP token.

The only requests are:

1. Native `POST /api/v1/authentication/sign-in` with the operator's environment-held credentials.
2. Native `POST /api/v1/projects/{QA1}/mcp-server/token`, using the returned USER token in memory.
3. MCP `tools/list` at the pinned `/mcp` endpoint, using the returned project token in memory.

Before step 2 the script checks native-response token metadata for USER type and future expiry. Before step 3 it checks the exact project/type, pinned MCP URL and the documented 900-second MCP lifetime (60 seconds clock skew). Metadata checks do not independently verify JWT signatures; native issuance comes from the pinned HTTPS service, and successful MCP access verifies provider acceptance. No token is signed, exported, written, logged or taken from a browser. HTTP redirects are rejected.

Receipts contain only stage, HTTP status, typed failure, missing variable names, or final tool count. A stage HTTP 200 is transport evidence only. Only the final `qa_native_auth_verified` receipt establishes this QA login/issuance/discovery chain. A 403 remains a stage rejection without assuming a licensing cause. Errors and response bodies are never printed. The script has no arbitrary tool executor, retries, grant writes, session revocation or production fallback. It does not prove cross-project RBAC, automatic renewal under load or a provider outcome.

Run only after the parent agent verifies secure configuration and approves the exact CLI guard:

```sh
node scripts/native-user-auth-probe.mjs
```

Nine mocked safety tests cover missing configuration, fixed routes, SERVICE rejection, project/type/lifetime mismatch, foreign endpoints, sanitized failures, SSE framing and fresh authentication. These tests are not live USER or RBAC proof.

Exact deployed-source baseline: Activepieces 0.92.1 / `23e0c254979c73cfbfbde00242668ee873e79508`:

- [Native sign-in](https://github.com/activepieces/activepieces/blob/23e0c254979c73cfbfbde00242668ee873e79508/packages/server/api/src/app/authentication/authentication.controller.ts)
- [Project MCP issuance requires USER and READ_MCP](https://github.com/activepieces/activepieces/blob/23e0c254979c73cfbfbde00242668ee873e79508/packages/server/api/src/app/mcp/mcp-server-controller.ts)
- [Native token lifetimes](https://github.com/activepieces/activepieces/blob/23e0c254979c73cfbfbde00242668ee873e79508/packages/server/api/src/app/mcp/oauth/token/mcp-oauth-token-lifetimes.ts)
