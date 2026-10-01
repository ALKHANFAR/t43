# ABO-55 release gate: local employee drafts

Saving a draft now uses Siyadah's database and returns `employee.status:disabled` with `employee.flowId:null`. It does not provision a project, create a flow, connect a tool, or enable execution. A later preparation path must attach a company-owned flow to the saved employee and validate it before activation; this PR does not make drafts runnable.

Before merging, run `node scripts/check-legacy-employee-flows.mjs` with read-only database access and the Activepieces read key in the intended environment. It compares each mapped company project's provider flows with stored employee flow IDs. The command exits nonzero if any provider-only flows remain, a provider listing reaches its 100-item bound, a project mismatches, or a read fails. Reconcile any reported legacy flows into company-owned employee rows before replacing the old hydrate adoption path. The command reads only and prints no credentials.

Recheck the target database migration immediately before release. `migrations/0002-local-employee-drafts.sql` keeps existing flow IDs and adds nullable local drafts plus a company-scoped creation request key. Do not describe a saved draft as execution-ready or count it as a completed run.
