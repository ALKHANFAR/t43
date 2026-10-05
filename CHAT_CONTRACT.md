# Siyadah chat contract — integrated review

This contract belongs to `ALKHANFAR/t43`. The customer frontend may change later; these meanings must remain stable across it. `77766` is not part of this path. Verify the current production head and deployment independently before calling a branch live.

## Request identity and company boundary

- The server derives `companyId` from the signed session. The browser does not choose a tenant or Activepieces project.
- A message supplies a stable `request_id` and `conversation_id`. Repeating **the same ID and content** reads the stored result; it does not dispatch again. Reusing the ID with different content or conversation returns 409.
- `op:work` with the same `request_id` reads status. A missing record and an uncertain recorded outcome both use `request_status:not_observed` today; the UI must say the result is unverified and must not retry with a new ID automatically.
- A *new* request ID is a new operation, even if the wording looks similar. The current `prior_request_id` field is not a cancellation guarantee.

## Project MCP chat

- The main chat and selected employee chat use the same server-side Activepieces MCP adapter. The server resolves the company project; no project ID, MCP token, or provider credential is accepted from the browser.
- Employee chat uses the `activepieces_flow_id` saved for that employee. For MCP tools with a `flowId` argument, the server fills a missing ID from that record and rejects a different ID both when preparing and when approving an action. Project switching and tools that select another Flow by listing, run ID, or creating one are hidden from employee chat. Catalog discovery remains available while an employee is a draft; Flow edits require its saved ID and approval. The model chooses whether a request is conversation, Flow editing, or an explicit run of the existing employee Flow; keyword matching no longer dispatches a run before the model sees the request.
- If the company project or MCP grant is not ready, the chat may answer from company context but must say it has not read an external app. It must not claim tool access or execution.
- A platform operator starts a separate MCP OAuth grant for each company project through `POST /internal/v1/mcp/connect` with the existing internal bearer token and `{ "tenantId": "..." }`. The operator completes Activepieces consent. The callback accepts only a token whose project claim matches the server-owned company mapping. The encrypted refresh token stays in Siyadah's database. This is an operator setup path, not a customer self-service OAuth flow.
- Discovery tools may be called from the chat. When the user requests a new Flow, `ap_build_flow` creates a disabled draft directly and Siyadah reads it back from the server-owned company project before confirming it. Other state-changing tools stop at a ten-minute, one-use approval tied to company and conversation. `op:approve` consumes that approval before dispatch. Repeating the same request ID returns its stored status; a new request ID cannot reuse the consumed approval.
- The approval response is `outcome_kind:conversation_reply` or `employee_draft`, `work_status:awaiting_input`, and includes `approval.required=true`. After an ordinary MCP execution response, the customer sees the tool's reply labelled unverified, with `outcome_kind:unverified` and `work_status:unknown`. A tool response alone does not establish provider readback, run ID, or KPI.
- After an approved `ap_create_table`, Siyadah reads `ap_list_tables` in the same company project and confirms a single exact ID, external ID, and name match in a complete inventory. It then gives the confirmed table to the chat planner for one continuation; a requested new Flow may be built as a disabled draft. A confirmed table is not a Flow or a provider run. If readback is incomplete or the table is absent, the result stays unverified and the action is not retried automatically.
- In main chat, creating an employee saves a company draft first. A request to build its Flow calls `ap_build_flow` directly, reads the returned Flow in the same Activepieces project, and links its ID to that employee only when the Flow remains `DISABLED`. A general `ap_build_flow` request without an employee reads back a disabled Flow and returns its ID without assigning it to an employee. These prove prepared draft Flows, not published or executed ones. Unknown build outcomes stay unverified and must not be dispatched again automatically.
- Activation checks the required connections as `PROJECT` and `ACTIVE`, checks that each belongs exclusively to the company project, and validates a new draft before `ap_lock_and_publish`. It reads back `ENABLED` and `publishedVersionId` before confirming activation. A saved connection alone does not activate a draft; the customer still requests activation. Validation is structural; a provider result requires a separate run and readback.
- This branch does not implement the three durable employee permission levels in ABO-67. Until that policy is enforced, executable MCP tool calls beyond building a disabled draft require separate approval. Do not describe this as permanent delegation or general customer launch readiness.

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
| Employee saved | `request_status:succeeded`, `outcome_kind:employee_draft`, `work_status:not_started`, `employee.status:disabled`, `employee.flowId:null` until prepared | The employee is saved as a draft in Siyadah; its tools and runnable flow are not ready and it has not acted. |
| Flow draft linked | `outcome_kind:employee_draft`, `employee.status:disabled`, `employee.flowId` after owned Flow readback | The Flow was saved for this employee and remains disabled; no task or provider action is proven. |
| General Flow draft | `outcome_kind:conversation_reply`, `flow_id` after owned Flow readback, no employee | The Flow was saved disabled in this company's project; no task or provider action is proven. |
| Uncertain outcome | `request_status:not_observed`, `outcome_kind:unverified`, `work_status:unknown` | The result is unverified; check the same request ID. |
| Rejected before dispatch | `request_status:failed`, `outcome_kind:unverified`, `work_status:failed`, no `transport_receipt` | The employee's task did not start. |
| Tool response without business proof | `request_status:not_observed`, `work_status:unknown`, optional `transport_receipt` | The tool replied, but the result is still being verified; do not dispatch again automatically. |
| External flow | `outcome_kind:external_run` plus scoped `runId` and execution record | Show only the level actually verified. Activepieces run success alone is not proof of the provider result or business impact. |

For a provider result, require a terminal scoped run, the relevant step output, and validation specific to that tool. A provider outcome must be read back separately before the UI says it succeeded. A customer-visible result and a KPI need their own evidence.

Saving an employee draft requires the company database and does not provision Activepieces. Building its disabled Flow requires an explicit user request and scoped MCP readback. A saved draft alone must never be described as execution-ready or activated.

## Release boundary

Before merging, compare the exact head and base, verify the resolved Railway pre-deploy command and schema, run the relevant acceptance tests, and read provider results at their own evidence level. A deployed build, an open PR, a merged commit, an Activepieces Flow, and a provider outcome are separate facts.
