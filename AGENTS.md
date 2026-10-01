# Siyadah working agreement

This `t43` repository owns the customer UI and its current server. `ALKHANFAR/77766` is a separate Siyadah Core repository between t43 and Activepieces; check its current interface before adding overlapping core logic here. Activepieces platform source stays separate. The existing Siyadah project in Linear is the single task tracker across these repositories; unifying Linear did not merge code repositories. Read `ARCHITECTURE.md` when it lands; its baseline is a snapshot, so verify the deployed Railway branch, commit and service again before production work.

## Start every task

1. Read the Linear issue and its dependencies. Search for an existing implementation before adding code. Reuse ABO-37 (contract), ABO-38 (company isolation), ABO-43 (flow), and ABO-44 (live UI) rather than creating duplicate implementations.
2. Check the reference branch and SHA against Railway and record them in the issue. The reference observed on 2026-10-01 was `codex/siyadah-integration-20260930` at `692cc690401aaa42b4b648c7f62060aca3f89693`; do not assume this remains current.
3. Check `git status` in every candidate checkout. Preserve all existing uncommitted work. Create a new branch and worktree from the verified reference SHA for one issue and one lane. For example: `git worktree add -b codex/ABO-XX-lane /path/to/new-worktree <verified-sha>`.
4. Put the issue ID, base SHA, worktree path, file scope, acceptance criteria, and intended test in the issue before implementation. If a feature crosses into `77766`, use a separate issue/PR/worktree there and review the t43-to-core contract on both sides. One integration owner reviews and merges PRs in dependency order.

## Three concurrent lanes

| Lane | Writes | Delivery |
| --- | --- | --- |
| A: design and frontend | Verified editable Figma file; `auth.html`, `app/chat.html`, `app/chat.js`, `app/onboard.html`, `app/onboard.js`, visual assets and matching UI tests | Reviewed screen states using the agreed API contract. Verify the exact editable Siyadah Figma URL, edit rights and artifact readback before treating it as the design source. Local `design/` previews are illustrative until tracked and verified; do not call them live or editable Figma. |
| B: Siyadah core | `server.mjs`, `lib/account-auth.mjs`, `lib/tenant-session.mjs`, `lib/company-profile.mjs`, `lib/chat-intelligence.mjs`, API contract, PostgreSQL schema/migrations and matching tests | Company-scoped t43 API, permissions, durable state and two-company isolation. B owns any SQL schema change here, including SQL currently inside integration modules, and coordinates any `77766` core change through its separate repository. |
| C: execution and integrations | Activepieces logic in `lib/tenant-projects.mjs` and `lib/tool-connections.mjs` excluding SQL schema changes, provider adapters and matching tests | Company-scoped flow, connection, run and provider-result readback. C requests server routes or schema changes from B. |

These scopes assign the first writer, not exclusive review. For example, A can build draft UI while B implements the draft API and C researches a later external action. All three use separate branches, worktrees and Linear issues; none writes the same file at the same time. `server.mjs`, shared API contracts, schema, `package.json`, deployment files, and `.github/` have one designated writer per change. Until SQL is moved out of C modules into versioned migrations, any schema edit inside a C file is one sequenced B-owned PR with C review; C rebases its integration work afterward. Assign new `app/` or other bridge files explicitly in Linear before editing. The integration owner sequences PRs that touch them.

## Shared contract and merge gate

- B proposes request, response, error and state changes in ABO-37 first. A and C review affected fields before their implementation. Never infer company or Activepieces project scope from browser-provided IDs.
- A conflict is resolved in the owning lane's PR, then dependent branches rebase onto the reviewed contract. Do not edit another lane's worktree, force-push its branch, or merge unreviewed partial work. This process reduces conflicts; it cannot guarantee zero conflicts.
- Each PR links its Linear issue, base SHA, affected contract/screens, meaningful local test result and proof for the exact claim. Require review from affected lanes before merge. Claims progress through draft, connection, test, run ID, provider result and customer-visible outcome separately.
- `npm test` is the repository test command. GitHub Actions currently cannot be used as a passing gate: on 2026-10-01 the GitHub billing lock stopped jobs before any step ran. Record local test output and manual review until billing and CI are restored. Verify a new successful CI run before making it a required branch check.
- PRs target the verified deployment branch, not `main` by assumption. Do not push directly to the deployed branch or deploy from a draft PR. On 2026-10-01 the deployed branch was protected with PR-only updates, admin enforcement, and no force push or deletion. It requires zero approving reviews because this repository currently has only one collaborator. Record the named owner acceptance for each affected lane in Linear and the PR; agents sharing one GitHub identity do not constitute an enforced independent approval. Add a second eligible reviewer when available, and require CI only after a successful run.

Never put credentials, tokens, session cookies, customer data or secret values in issues, prompts, code, test output or PRs. A healthy endpoint or a successful deployment proves only that layer, not an end-to-end customer journey.
