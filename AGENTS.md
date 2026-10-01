# Siyadah work in this repository

- The code authority is `ALKHANFAR/t43`. Do not import or connect `77766`. Confirm the current branch, production SHA and `git status` before changes; preserve the older dirty worktrees.
- Start feature work with `node scripts/feature-index.mjs "اسم الميزة"` and `FEATURE_INDEX.md`. The index records what the customer calls a feature, its actual state, exact source anchors, tests, Linear issue and PR. If the feature is absent, use `rg` to locate it and add an index entry.
- Update `features/index.json` in the same PR as a feature change. Run `npm run index:check` and the relevant behavior tests. Do not label a preview, mocked test, HTTP response, saved draft or deployment badge as a completed provider outcome.
- Record each meaningful change, finding, test result and blocker in its issue inside the existing Siyadah Linear project; include branch/commit/PR and the evidence level. Keep a draft PR until its dependent contracts and release gates are reviewed.
- When customer-facing permissions or tool connections are needed, ask at the action that needs them. Saving a disabled employee draft does not require external execution or claim that a runnable flow is ready.
