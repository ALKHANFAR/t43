# Siyadah integration branch

This repository has one delivery-candidate branch:

`codex/siyadah-integration-20260930`

`main` remains unchanged until this branch passes the complete customer journey and is explicitly approved for release.

## Included

- Working Siyadah chat route and server-derived company scope.
- Account authentication and branded transactional email assets.
- Firecrawl company enrichment, sourced knowledge, corrections, and versions.
- Three employee recommendations and company-scoped employee records.
- Company settings, employee conversations, and execution-proof surfaces.
- Activepieces project-per-company provisioning and disabled draft flows.
- Public-file allowlist that blocks server source, package manifests, libraries, scripts, and developer-only pages.
- Isolated developer comparison lab; it is not exposed to customers.

Reference lineage:

- `codex/fix-siyadah-chat-route`
- `codex/backup-auth-email-20260929`
- `codex/hide-server-source-20260930`

## Not merged wholesale

These branches are historical or alternative implementations. They must not be merged wholesale into the delivery branch:

- `base/v1.9.0`: contains an older nginx/gateway deployment and a connection UI that targets `/v1/connect/*`, which the current Siyadah server does not expose.
- `codex/native-activepieces-chat`: replaces the current governed Siyadah chat path with a different native Agent Runtime path.
- `codex/direct-mcp-clean-lab`, `codex/activepieces-direct-mcp-live`, and `codex/openai-activepieces-chat-e2e`: experimental direct-browser/MCP paths that conflict with the current server-side company boundary.

Useful behavior from these branches may be ported as a reviewed change with current APIs and tests. Their branch histories are not release inputs.

## Pending work before release

- Understand the employee request before creating a draft; do not use the raw user sentence as the employee name.
- Persist working memory for goals, constraints, and decisions beyond the last eight messages.
- Build a non-empty disabled flow with a trigger, steps, proposed tools, and unresolved connection requirements.
- Implement the current Siyadah-owned connection broker and project-scoped OAuth callback.
- Prove two-company isolation through project, connection, employee, flow, run, provider result, and customer-visible result.
- Finish the password-reset journey by using the delivered link and logging in with the new password.
- Audit every customer-facing button for an API call, stored state, failure state, and readback evidence.

## Merge policy

1. Commit new work to a focused topic branch or reviewed worktree.
2. Compare it with this branch by patch content, not branch name.
3. Port only the approved commits or implementation, resolving against current APIs.
4. Run the full test suite and the relevant live acceptance journey.
5. Update this manifest and push this branch.
6. Do not merge into `main` without an explicit final release decision.

## Proof boundary

Draft creation is not execution. Completion requires:

`company_id -> Activepieces project -> project connection -> employee permission -> valid flow -> runId -> provider result -> customer-visible outcome`

`77766` is outside this implementation and must not be connected to it.
