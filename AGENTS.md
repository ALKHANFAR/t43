# Siyadah work in this repository

- The code authority is `ALKHANFAR/t43`. Do not import or connect `77766`. Confirm the current branch, production SHA and `git status` before changes; preserve the older dirty worktrees.
- Start feature work with `node scripts/feature-index.mjs "اسم الميزة"` and `FEATURE_INDEX.md`. The index records what the customer calls a feature, its actual state, exact source anchors, tests, Linear issue and PR. If the feature is absent, use `rg` to locate it and add an index entry.
- Update `features/index.json` in the same PR as a feature change. Run `npm run index:check` and the relevant behavior tests. Do not label a preview, mocked test, HTTP response, saved draft or deployment badge as a completed provider outcome.
- Record each meaningful change, finding, test result and blocker in its issue inside the existing Siyadah Linear project; include branch/commit/PR and the evidence level. Keep a draft PR until its dependent contracts and release gates are reviewed.
- When customer-facing permissions or tool connections are needed, ask at the action that needs them. Saving a disabled employee draft does not require external execution or claim that a runnable flow is ready.

## Three work lanes and integration

Read `ARCHITECTURE.md` for current ownership and `README.md` for the distinction between the Railway app and LWS public site. Check the relevant Linear issue and the exact Railway source branch, deployed SHA and clean worktree before starting. Use one branch and worktree per task; preserve existing dirty worktrees. The original Siyadah Linear project `P-ABO-2` is the single work log.

- A owns Figma review and page-level UI files. Current `design/` previews are illustrative; the founder may replace the visuals, content and interaction within every page.
- B owns `server.mjs`, shared API contracts, permissions, PostgreSQL schema and migrations.
- C owns Activepieces project / connection / flow adapters and run readback. B reviews SQL or shared-route changes inside integration files.

For a shared contract, B records request, response, error and state changes in ABO-37; A and C review before implementing dependent work. Assign a single writer to `server.mjs`, `package.json`, migrations and deployment files in the issue. Merge reviewed PRs in dependency order into the verified deployment branch; do not assume `main` is serving customers. Record evidence separately for draft, connection, test, run, provider result and customer-visible result. GitHub Standards cannot be treated as passing while billing blocks jobs from starting; use meaningful local checks and a stated manual review until CI runs again.
