# Siyadah chat contract — integrated review

This contract belongs to `ALKHANFAR/t43`. The customer frontend may change later; these meanings must remain stable across it. `77766` is not part of this path. Verify the current production head and deployment independently before calling a branch live.

## Request identity and company boundary

- The server derives `companyId` from the signed session. The browser does not choose a tenant or Activepieces project.
- A message supplies a stable `request_id` and `conversation_id`. Repeating **the same ID and content** reads the stored result; it does not dispatch again. Reusing the ID with different content or conversation returns 409.
- `op:work` with the same `request_id` reads status. A missing record and an uncertain recorded outcome both use `request_status:not_observed` today; the UI must say the result is unverified and must not retry with a new ID automatically.
- A *new* request ID is a new operation, even if the wording looks similar. The current `prior_request_id` field is not a cancellation guarantee.

## Project MCP chat

- Within one model/tool request, the adapter reuses a project access token until its advertised lifetime approaches expiry. Every call still reads the current company project and saved grant; changing or deleting either prevents reuse. Separate requests have separate token state. Failed calls discard that state without automatically replaying tool writes.

- The main chat and selected employee chat use the same server-side Activepieces MCP adapter. The server resolves the company project; no project ID, MCP token, or provider credential is accepted from the browser.
- Employee chat uses the `activepieces_flow_id` saved for that employee. For MCP tools with a `flowId` argument, the server fills a missing ID from that record and rejects a different ID. Project switching and tools that select another Flow by listing, run ID, or creating one are hidden from employee chat. Catalog discovery remains available while an employee is a draft. An active employee can call only its exact native MCP Flow tool when the owned published Flow uses the MCP Tool trigger with Wait for Response. A legacy Flow without that trigger remains available for discussion and editing, but cannot be run from employee chat. Siyadah makes no direct Activepieces Webhook request.
- If the company project or MCP grant is not ready, the chat may answer from company context but must say it has not read an external app. It must not claim tool access or execution.
- For live data from a connected app, the model must call that provider's MCP tool in the current request and answer from its result. Company context or an earlier reply is not a current provider readback.
- A platform operator starts a separate MCP OAuth grant for each company project through `POST /internal/v1/mcp/connect` with the existing internal bearer token and `{ "tenantId": "..." }`. The operator completes Activepieces consent. The callback accepts only a token whose project claim matches the server-owned company mapping. The encrypted refresh token stays in Siyadah's database. This is an operator setup path, not a customer self-service OAuth flow.
- Owner decision, 2026-10-05: every tool the company project exposes runs directly from the chat, including publishing and one-off external actions. There is no per-call approval. The server sends the model the usage guide that the Activepieces MCP server returns from `initialize`, and returns every tool result to the model, a failed one included, so it can correct the call and continue. The model writes the final reply from those results. `op:approve` remains only to settle approvals issued before this change.
- The approval response is `outcome_kind:conversation_reply` or `employee_draft`, `work_status:awaiting_input`, and includes `approval.required=true`. When every dispatched effect is an `ap_run_action` with a recognized native completion receipt, parseable JSON output, and no reported HTTP/provider error, the request uses `outcome_kind:tool_result` and `work_status:succeeded`. This means the native action calls completed, not that a larger business goal or KPI was proved. Missing results, mixed writes and uncertain dispatches remain `unverified/unknown`. A tool receipt alone does not establish provider readback or KPI. `ap_run_action` may return one-shot output and an ActionRun ID without creating a Flow.
- `tool_receipts` lists at most 80 model-invoked calls and local/transport failures in order. Entries contain the name and `returned/error`, with `effect_attempted:true` only after dispatch begins. A recognized native ActionRun receipt may include its 21-character `run_id` and `outcome:action_completed/unverified`; never arguments, credentials or provider contents. `output_limited:true` records an official AP shortening notice; recognizing completion never claims the full body was preserved. Native footer notes are excluded only from receipt JSON validation, never from the model input. An error entry does not imply a provider replied. The receipt is saved with the request and available through `op:work`; the hydrated conversation transcript does not yet restore its visual panel after reload.
- After an approved `ap_create_table`, Siyadah reads `ap_list_tables` in the same company project and confirms a single exact ID, external ID, and name match in a complete inventory. It then gives the confirmed table to the chat planner for one continuation; a requested new Flow may be built as a disabled draft. A confirmed table is not a Flow or a provider run. If readback is incomplete or the table is absent, the result stays unverified and the action is not retried automatically.
- When the model calls `ap_build_flow` for an employee, Siyadah saves a draft and links only a `DISABLED` Flow read back from that company's project. A failed build links nothing. Activation checks `PROJECT` and `ACTIVE` connections, validates the draft, tests the current Flow version through MCP, reads that TESTING run as `SUCCEEDED`, then publishes and reads back `ENABLED`. If a connection is missing, the new employee's request receipt retains an activation intent for the same employee and Flow; returning after connection resumes the test. Explicit draft-only and disable requests do not auto-activate. A tool reply or saved connection alone is not provider proof.
- What stays enforced: the server derives the company and its project; `ap_set_project_context` is never offered; a connection passed to `ap_run_action` must belong exclusively to the company project; employee chat stays on its saved Flow. The three durable employee permission levels in ABO-67 are not implemented; this open mode replaces the interim approval until they are. A request that runs longer than twenty seconds answers `queued` and is read by the same `request_id`; an unfinished request becomes `not_observed` after fifteen minutes. The accepted user message is stored idempotently before processing. Hydration restores owned pending work from the existing ledger. Model history excludes this request and later accepted requests; the persisted conversation queue orders execution. Waiting and model execution share a 12-minute budget, leaving headroom before ledger expiry. Numeric model usage and per-tool timing are logged without message or tool-input contents.

## Meaning of response fields

| Field | Meaning | May prove an external action? |
| --- | --- | --- |
| `request_status` | Whether Siyadah recorded and handled this request: `queued`, `succeeded`, `failed`, `not_observed` | No |
| `outcome_kind` | What kind of response was produced: `conversation_reply`, `employee_draft`, `external_run`, `tool_result`, `employee_ready`, `unverified` | Only identifies the kind; proof is separate |
| `work_status` | Legacy progress/status field; `not_started` for a reply or disabled employee draft | Never by itself |
| `work_id` | Identifier for status tracking; a `request_…` value is not a provider run | No |
| `recent_work[].runId` | Activepieces run reference | Proves a run reference, not a provider outcome |
| `transport_receipt` | Optional scoped run ID and HTTP status for a response whose business outcome is still unverified | Proves transport only; never success |
| `tool_receipts[]` | Ordered, bounded results returned by MCP for the current request | Identifies returned calls, errors and recognized native completion; never a business outcome |

### Cases the frontend must distinguish

| Case | Contract | Customer wording |
| --- | --- | --- |
| Ordinary answer | `request_status:succeeded`, `outcome_kind:conversation_reply`, `work_status:not_started` | The answer was returned; any read-only MCP calls appear separately in `tool_receipts`. No external write is implied. |
| Employee saved | `request_status:succeeded`, `outcome_kind:employee_draft`, `work_status:not_started`, `employee.status:disabled`, `employee.flowId:null` until prepared | The employee is saved as a draft in Siyadah; its tools and runnable flow are not ready and it has not acted. |
| Flow draft linked | `outcome_kind:employee_draft`, `employee.status:disabled`, `employee.flowId` after owned Flow readback | The Flow was saved for this employee and remains disabled; no task or provider action is proven. |
| Activation after connection | A newly built, linked, disabled employee Flow may carry `auto_activate_after_connection:true` with its exact employee and Flow IDs in the saved request receipt. `resume_employee_activation` returns `none`, `pending`, or `active`. | Only the single matching employee is tested and activated after every required connection is active; `pending` never means it has started. A test run can have real external effects even in TESTING. |
| General Flow draft | `outcome_kind:conversation_reply`, `flow_id` after owned Flow readback, no employee | The Flow was saved disabled in this company's project; no task or provider action is proven. |
| Uncertain outcome | `request_status:not_observed`, `outcome_kind:unverified`, `work_status:unknown` | The result is unverified; check the same request ID. |
| Rejected before dispatch | `request_status:failed`, `outcome_kind:unverified`, `work_status:failed`, no `transport_receipt` | The employee's task did not start. |
| Employee tested and activated | `request_status:succeeded`, `work_status:succeeded`, `outcome_kind:employee_ready`, verified `readiness_receipt` | Configuration test and activation verified; no production task or KPI is implied. Mixed effects keep the overall request unverified. |
| Completed native action calls | `request_status:succeeded`, `outcome_kind:tool_result`, `work_status:succeeded` | The native calls completed. An ActionRun reference is not a saved FlowRun or a KPI. |
| Tool response without business proof | `request_status:not_observed`, `work_status:unknown`, optional `transport_receipt` | The tool replied, but the result is still being verified; do not dispatch again automatically. |
| External flow | `outcome_kind:external_run` plus scoped `runId` and execution record | Show only the level actually verified. Activepieces run success alone is not proof of the provider result or business impact. |

For a provider result from a Flow, require a terminal scoped FlowRun, the relevant step output, and validation specific to that tool. For a one-shot `ap_run_action`, use its returned ActionRun output and validate the evidence specific to that action; it does not create a Flow. `isError:false` or HTTP 200 alone is insufficient, especially for writes or empty output. A customer-visible result and a KPI need their own evidence.

Saving an employee draft requires the company database and does not provision Activepieces. In main chat the model decides whether the user's goal calls for a Flow, then creates at most one employee draft when it invokes `ap_build_flow`; scoped MCP readback is required before linking. A saved draft alone must never be described as execution-ready or activated. A real test and provider result must precede the customer's decision to enable ongoing work.

## Release boundary

Before merging, compare the exact head and base, verify the resolved Railway pre-deploy command and schema, run the relevant acceptance tests, and read provider results at their own evidence level. A deployed build, an open PR, a merged commit, an Activepieces Flow, and a provider outcome are separate facts.

## Employee instructions — conversation context and Activepieces work

`employee_instructions` saves the selected company's employee context in PostgreSQL. Its response has `instructions_verified:true` and `instruction_scope:conversation`; verification means the stored text was read back, not that an Activepieces step or shared Agent changed. The main-chat saved draft includes these instructions and their source/version, just as selected-employee chat does.

To apply saved instructions to ongoing work, use the existing message route with the selected `employee_id`. The UI prepares the request without sending it automatically and requires unsaved edits to be saved first. The model reads the owned Flow and AI schema, edits the per-step prompt without dropping task variables, then reads back, tests and publishes through the existing MCP path. A `run_agent` step prompt is a per-Flow overlay; do not change a shared Agent's base instructions. No suitable AI step, a failed test, or uncertain readback must not be displayed as runtime adoption.

The editable saved-context panel is conversation context. Opening instructions requests `employee_instructions` with `read_published:true`; the separate read-only `published_instructions` section reads the owned exact published Flow version. The two reads must agree on the published pointer; a publish race, wrong ownership or provider failure returns `read_status:unavailable` without prompts. No published version returns `not_published`. `verified` means version readback only, not activation, execution or synchronization.

The projection preserves literal AI `askAi` and `run_agent` prompt inputs, including variable references, without returning full settings/auth. A saved Agent task input is marked separately and `agent_instructions_unverified:true` prevents claiming its saved Agent instructions were read. Unknown AI actions have no projected prompt. UI reads lazily on each opening, preserves editable conversation text and discards stale employee/panel responses. Read mode writes no instructions, Flow or Agent and never tests/publishes.


## Employee readiness receipt

`readiness_receipt` contains `employee_id`, `flow_id`, `published_version_id`, `test_run_id` and `test_environment:TESTING`. Optional `used_mock_trigger_data` is a Boolean from the native test response, not the run readback. The server verifies a fresh successful test for this owned Flow, unchanged business configuration, the exact tested version published and ENABLED, and the employee saved active. Old active state, missing proof, version/configuration changes or a failed state save cannot create a receipt.

Comparisons ignore only native test metadata: version `updated`/`updatedBy` and graph step `settings.sampleData`. Business inputs, prompt text, task variables and step references remain compared. Native lifecycle changes must not substitute a different version or configuration.

Only setup effects on this same Flow can produce `employee_ready`. A request with other effects keeps `unverified/unknown` and carries readiness independently. The UI retains the model reply, validates matching employee and Flow IDs, exposes TESTING evidence behind details, and excludes readiness from production work and KPI displays. TESTING may use mock trigger data and may execute real actions; readiness does not establish a production provider outcome.

After building or changing the owned Flow's published state, the model receives the unchanged native MCP result plus `siyadahContext` with the saved employee and any verified readiness receipt before writing its next reply. An unresolved state readback is marked `employeeStateVerified:false`; it does not supply a newly confirmed employee state. Publishing then pausing in one request must end with the saved employee disabled and no readiness receipt. The published MCP trigger's Wait for Response value accepts native `true` and `"true"` only; the owned published-version and exact tool-name checks remain required.

## Native employee production run receipt

The selected employee's native Flow MCP result may carry `structuredContent.execution` from Activepieces' existing `onRunCreated` callback: `runId`, `flowId`, `projectId`, `flowVersionId`, and `environment`. This identifies a created run, not a completed task. Siyadah accepts only its own project, saved employee Flow, current published version, and `PRODUCTION`, then reads that exact ID with scoped `ap_get_run`. Only `SUCCEEDED` with recorded steps and a matching `recordEmployeeRun` readback produces `outcome:flow_completed` and `run_id` in the receipt. Missing, mismatched, nonterminal, failed, or unsaved evidence remains unknown without repeating execution. Mixed effects remain unverified. Flow completion does not establish a generic provider or business KPI; provider results require their own native evidence.
