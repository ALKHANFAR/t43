# Siyadah chat contract — integrated review

This contract belongs to `ALKHANFAR/t43`. The customer frontend may change later; these meanings must remain stable across it. `77766` is not part of this path. The current integrated review head is [PR #24](https://github.com/ALKHANFAR/t43/pull/24); PRs #13, #14, #18 and #19 remain historical slices, not separate release heads.

## Request identity and company boundary

- The server derives `companyId` from the signed session. The browser does not choose a tenant or Activepieces project.
- A message supplies a stable `request_id` and `conversation_id`. Repeating **the same ID and content** reads the stored result; it does not dispatch again. Reusing the ID with different content or conversation returns 409.
- `op:work` with the same `request_id` reads status. A missing record and an uncertain recorded outcome both use `request_status:not_observed` today; the UI must say the result is unverified and must not retry with a new ID automatically.
- A *new* request ID is a new operation, even if the wording looks similar. The current `prior_request_id` field is not a cancellation guarantee.

## Meaning of response fields

| Field | Meaning | May prove an external action? |
| --- | --- | --- |
| `request_status` | Whether Siyadah recorded and handled this request: `queued`, `succeeded`, `failed`, `not_observed` | No |
| `outcome_kind` | What kind of response was produced: `conversation_reply`, `employee_draft`, `external_run`, `unverified` | Only identifies the kind; proof is separate |
| `work_status` | Legacy progress/status field; `not_started` for a reply or disabled employee draft | Never by itself |
| `work_id` | Identifier for status tracking; a `request_…` value is not a provider run | No |
| `recent_work[].runId` | Activepieces run reference | Proves a run reference, not a provider outcome |
| `transport_receipt` | Optional scoped run ID and HTTP status for a response whose business outcome is still unverified | Proves transport only; never success |

### Cases the frontend must distinguish

| Case | Contract | Customer wording |
| --- | --- | --- |
| Ordinary answer | `request_status:succeeded`, `outcome_kind:conversation_reply`, `work_status:not_started` | The answer was returned; no tool run is implied. |
| Employee saved | `request_status:succeeded`, `outcome_kind:employee_draft`, `work_status:not_started`, `employee.status:disabled`, `employee.flowId:null` until prepared | The employee is saved in Siyadah; its tools and runnable flow are not ready and it has not acted. |
| Uncertain outcome | `request_status:not_observed`, `outcome_kind:unverified`, `work_status:unknown` | The result is unverified; check the same request ID. |
| Rejected before dispatch | `request_status:failed`, `outcome_kind:unverified`, `work_status:failed`, no `transport_receipt` | The employee's task did not start. |
| Tool response without business proof | `request_status:not_observed`, `work_status:unknown`, optional `transport_receipt` | The tool replied, but the result is still being verified; do not dispatch again automatically. |
| External flow | `outcome_kind:external_run` plus scoped `runId` and execution record | Show only the level actually verified. Activepieces run success alone is not proof of the provider result or business impact. |

For a provider result, require a terminal scoped run, the relevant step output, and validation specific to that tool. A provider outcome must be read back separately before the UI says it succeeded. A customer-visible result and a KPI need their own evidence. PR #24 includes the unknown-result wording and the `not_started` distinction; verify both against the served deployment before calling either a customer-visible result.

Saving an employee draft requires the company database and does not provision Activepieces. A later preparation path must attach a company-owned flow to the saved employee ID, validate its tools, and then enable execution. A saved draft alone must never be described as execution-ready or activated.

## Release boundary

This contract is part of PR #24, whose base is `codex/siyadah-integration-20260930`. A deployed build, an open PR, and a merge into that base or `main` are separate facts. Before merging, compare the exact head and base, verify the resolved Railway pre-deploy command and schema, run the relevant acceptance tests, and read provider results at their own evidence level. The earlier PRs remain review history and must not be merged again as parallel releases.
