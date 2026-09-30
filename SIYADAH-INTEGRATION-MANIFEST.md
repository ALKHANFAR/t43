# Siyadah integration branch

This repository has one delivery-candidate branch:

`codex/siyadah-integration-20260930`

`main` remains unchanged until this branch passes the complete customer journey and is explicitly approved for release.

## Included

- Working Siyadah chat route and server-derived company scope.
- Account authentication and branded transactional email assets.
- Bilingual Siyadah account layout using the existing wordmark and mark, with RTL/LTR field states and a restrained split-screen story.
- Account story has three selectable illustrative stages and a quiet password-length cue; email confirmation keeps its token and offers retry after a connection failure.
- Account copy now leaves login and signup at one heading and their fields; the selectable story reveals detail only when chosen. The original mark is white without a surrounding box, while recovery retains its necessary instruction.
- Onboarding offers a visible exit. Chat and onboarding report logout failure in place and redirect only after the server confirms logout.
- Shared Siyadah appearance tokens across public and customer pages; page layouts stay separate so future themes can replace visual values without changing customer flows.
- Cloudlight-inspired bilingual public story showing company context, permission, and proof as selectable illustrative stages.
- Product-wide interaction language documented in `INTERACTION-LANGUAGE.md`; visible states distinguish a proposal from a run and a verified result.
- Public hero and role list now use short, scannable states; the hero is explicitly illustrative and no longer presents a fake live session or timer.
- Public access form reports delivery failure without claiming a reserved seat; sent state appears only after a successful HTTP response.
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
- Visually inspect account creation and recovery in Arabic and English at 360px and desktop size; verify the real confirmation and reset journeys before release.
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
