# ABO-55 release gate: local employee drafts

Saving a draft now uses Siyadah's database and returns `employee.status:disabled` with `employee.flowId:null`. It does not provision a project, create a flow, connect a tool, or enable execution. A later preparation path must attach a company-owned flow to the saved employee and validate it before activation; this PR does not make drafts runnable.

The onboarding browser keeps its creation request ID across a refresh in the same tab and clears it after a confirmed save. The database enforces uniqueness per company and rejects a changed selection or name under the same ID. Starting a new browser session with a new ID is a new creation request; it is not an automatic recovery of an older uncertain request.

Before merging, run `node scripts/check-legacy-employee-flows.mjs` with read-only database access and the Activepieces read key in the intended environment. It compares each mapped company project's provider flows with stored employee flow IDs. The command exits nonzero if any provider-only flows remain, a provider listing reaches its 100-item bound, a project mismatches, or a read fails. It prints aggregate counts only. If `unadoptedCount>0`, stop the merge and perform a separate secured, read-only match of company and flow IDs before reconciling those rows. Do not put customer or flow IDs into general logs.

Recheck the target database migration immediately before release. `migrations/0002-local-employee-drafts.sql` keeps existing flow IDs and adds nullable local drafts plus a company-scoped creation request key. Do not describe a saved draft as execution-ready or count it as a completed run.
