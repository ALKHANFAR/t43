# Native customer membership and paired release — 8 October 2026

## Reviewed serving release

- t43 PR #64 merged into actual serving branch `codex/abo-38-isolation-gate-20261001`: `e75375c2afca6c1e3290b9fd1d3f8351ede20ed1`; Railway UI deployment `dafaf3fa-19f3-438c-8010-c76c460acbf5` SUCCESS.
- Served `/app/chat.js` and reviewed source share SHA256 `b8354667886eada48f31b07f4d28c01b04e0dc27f48eea76c4ef64e47eb33329`.
- Activepieces PR #4 merged into `main`: `c92aec3f0533b1c76b3a0de295047024318a3dd6`; app `01c171bf-7d9b-404a-8813-43c17fa35139` and worker `0b27499e-0905-4a7c-a206-019a4381a48e` SUCCESS at that exact commit.

## Actual new production customer

Actual signup, delivered verification email, verification endpoint and login provisioned company `company_o40sLBIVNsRHctV6RcfaCfUt`, mapped company project `re8CN4808AZAAwxkkT1S6`. No account or mapping was seeded. All signup addresses belong to the operator's mailbox.

A provisioning gap was found: starting MCP consent did not grant native membership to the customer's verified email. Calling the existing native PROJECT invitation API for this company project returned ACCEPTED. The newly registered native actor `gO0uh5G3nPlTbMeMGxIOY` has platform role MEMBER. This actor approved native MCP authorization for the company project; the real Siyadah callback accepted it in the same customer session. This proves a non-admin consent actor through actual APIs, not browser self-service or embedded SSO.

The follow-up uses the company's single verified email, existing project mapping, and native PROJECT/Editor invitation before registering consent. Browser input cannot choose project, identity or role. Native project role/seat/entitlement checks remain authoritative. Current platform supports project roles, but embedding is disabled; native login or registration using the same email remains necessary. No signing-key bypass, database permission mutation or parallel credential engine was added.

## Build evidence versus execution evidence

The real production model built Flow `9fAnDkFec1jeo8DSNouL2` through native `ap_build_flow`, adjusted its trigger through MCP, tested it and published it through `ap_lock_and_publish`. Native steps: MCP Wait for Response, HTTP public Open-Meteo Riyadh, Reply to MCP. No CODE or Run Agent. Published version `vi80NJBNqmWP6t3CInKAB`; TESTING run `SnaRl3mkUSMW1kT8J1E7J` used mock trigger data with a real public HTTP request. Employee `264e7cad-e08c-4a1e-9f42-b6278272d902` activated. This paragraph proves build/test/activation only; employee execution needs its separate production run.

## Follow-up verification

Full npm test exited 0: 417 runtime tests, 416 passed, 1 skipped, 0 failed; feature index, static checks and Chrome accessibility passed (all ten pages 100/100). Tests reject absent/ambiguous verified identities, cross-project or mismatched native invitation readback, pending/platform invitations and OAuth registration before verified membership. Shared contract documented in CHAT_CONTRACT.md. Manual SQL/route/native adapter contract review completed; GitHub CI billing blockage remains a limitation, not a passing check.

Authenticated Asana OAuth reached the provider login page through Skyvern. No saved Skyvern credentials were available. Provider connection and authenticated provider result remain unproved pending the user's personal login and consent. No passwords or OAuth credentials are included in this evidence.
