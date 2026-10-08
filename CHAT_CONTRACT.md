# Siyadah chat contract — integrated review

This contract belongs to `ALKHANFAR/t43`. The customer frontend may change later; these meanings must remain stable across it. `77766` is not part of this path. Verify the current production head and deployment independently before calling a branch live.

## Request identity and company boundary

- The server derives `companyId` from the signed session. The browser does not choose a tenant or Activepieces project.
- A message supplies a stable `request_id` and `conversation_id`. Repeating **the same ID and content** reads the stored result; it does not dispatch again. Reusing the ID with different content or conversation returns 409.
- `op:work` with the same `request_id` reads status. A missing record and an uncertain recorded outcome both use `request_status:not_observed` today; the UI must say the result is unverified and must not retry with a new ID automatically.
- A *new* request ID is a new operation, even if the wording looks similar. The current `prior_request_id` field is not a cancellation guarantee.

## Project MCP chat

### Customer MCP consent (draft PR, not deployed)

`GET /siyadah-api/v1/mcp/status` uses the authenticated company session and performs only local grant/project reads. It returns `state: project_required | authorization_required | authorization_stored` and `liveVerified: false`. Stored authorization is not proof of a working native MCP call.

`POST /siyadah-api/v1/mcp/connect` accepts only `{}` and requires the configured same Origin. The server verifies the company account, reuses its existing project ensure, and returns the native OAuth authorization URL. Company/project IDs and scope supplied by the browser are rejected. Native consent still requires the customer's action.

Customer OAuth state is encrypted and bound to the initiating company session. Callback completion rejects a missing, changed or foreign session before token exchange or grant storage. Existing internal unbound OAuth starts retain compatibility. No Flow mutation or tool/auth-field discovery REST endpoint is introduced.

The start response includes `authorizationRevision`, a digest of the native registration's public OAuth client ID. Status includes `grantRevision` for the stored client registration. The UI confirms this consent attempt only when these match; refresh-token rotation cannot complete an unrelated consent attempt. These markers are not access tokens and do not prove native tool readiness. The modal opens consent only on a user click and polls while open with a bounded deadline; closing it cancels observation without replaying chat requests or tool actions.

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
| `outcome_kind` | What kind of response was produced: `conversation_reply`, `employee_draft`, `flow_draft_saved`, `external_run`, `tool_result`, `employee_ready`, `unverified` | Only identifies the kind; proof is separate |
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
| Verified Flow draft | `outcome_kind:flow_draft_saved`, `request_status:succeeded`, `work_status:succeeded`, `draft_receipt` with `flow_id`, `version_id`, `status:DRAFT` after owned Flow readback | The requested native Flow edits returned and the current Flow is saved disabled in this company's project. A verified exact `TESTING` run adds `test_run_id`, `test_environment:TESTING` and the native `used_mock_trigger_data` flag when provided; an edit after the test or an unverified test keeps the overall request unknown. This proves no publication, production run, provider result or KPI. |
| General Flow draft without a settled receipt | `outcome_kind:conversation_reply` or `unverified`, `flow_id` after owned Flow readback | A saved draft can be shown without claiming the whole multi-step request succeeded. |
| Uncertain outcome | `request_status:not_observed`, `outcome_kind:unverified`, `work_status:unknown` | The result is unverified; check the same request ID. |
| Rejected before dispatch | `request_status:failed`, `outcome_kind:unverified`, `work_status:failed`, no `transport_receipt` | The employee's task did not start. |
| Employee tested and activated | `request_status:succeeded`, `work_status:succeeded`, `outcome_kind:employee_ready`, verified `readiness_receipt` | Configuration test and activation verified; no production task or KPI is implied. Mixed effects keep the overall request unverified. |
| Completed native action calls | `request_status:succeeded`, `outcome_kind:tool_result`, `work_status:succeeded` | The native calls completed. An ActionRun reference is not a saved FlowRun or a KPI. |
| Tool response without business proof | `request_status:not_observed`, `work_status:unknown`, optional `transport_receipt` | The tool replied, but the result is still being verified; do not dispatch again automatically. |
| External flow | `outcome_kind:external_run` plus scoped `runId` and execution record | Show only the level actually verified. Activepieces run success alone is not proof of the provider result or business impact. |

For a provider result from a Flow, require a terminal scoped FlowRun, the relevant step output, and validation specific to that tool. For a one-shot `ap_run_action`, use its returned ActionRun output and validate the evidence specific to that action; it does not create a Flow. `isError:false` or HTTP 200 alone is insufficient, especially for writes or empty output. A customer-visible result and a KPI need their own evidence.

Saving an employee draft requires the company database and does not provision Activepieces. In main chat the model decides whether the user's goal calls for a Flow, then creates at most one employee draft when it invokes `ap_build_flow`; scoped MCP readback is required before linking. A saved draft alone must never be described as execution-ready or activated. A real test and provider result must precede the customer's decision to enable ongoing work.

When the current customer request explicitly says to keep the Flow as a draft or not publish it, the chat MCP dispatcher rejects publish and enable calls and does not queue automatic activation. An explicit instruction not to run also rejects Flow test, retry, direct action, and selected employee Flow execution calls. These request-level guards leave the Flow disabled; a later request to publish or run is evaluated on its own permissions and readiness evidence.

## Release boundary

Before merging, compare the exact head and base, verify the resolved Railway pre-deploy command and schema, run the relevant acceptance tests, and read provider results at their own evidence level. A deployed build, an open PR, a merged commit, an Activepieces Flow, and a provider outcome are separate facts.

## Employee instructions — conversation context and Activepieces work

`employee_instructions` saves the selected company's employee context in PostgreSQL. Its response has `instructions_verified:true` and `instruction_scope:conversation`; verification means the stored text was read back, not that an Activepieces step or shared Agent changed. The main-chat saved draft includes these instructions and their source/version, just as selected-employee chat does.

To apply saved instructions to ongoing work, use the existing message route with the selected `employee_id`. The UI prepares the request without sending it automatically and requires unsaved edits to be saved first. The model reads the owned Flow and AI schema, edits the per-step prompt without dropping task variables, then reads back, tests and publishes through the existing MCP path. A `run_agent` step prompt is a per-Flow overlay; do not change a shared Agent's base instructions. No suitable AI step, a failed test, or uncertain readback must not be displayed as runtime adoption.

The editable saved-context panel is conversation context. Opening instructions requests `employee_instructions` with `read_published:true`; the separate read-only `published_instructions` section reads the owned exact published Flow version. The two reads must agree on the published pointer; a publish race, wrong ownership or provider failure returns `read_status:unavailable` without prompts. No published version returns `not_published`. `verified` means version readback only, not activation, execution or synchronization.

The same verified published response adds `work_steps` and `work_structure_complete`. These describe the native Flow graph, including non-AI actions, branches and loops. Step metadata is allowlisted; inputs, auth, conditions, code and sample data are not returned. Missing or unavailable publication returns an empty structure with completeness false. Unknown nodes or traversal limits make completeness false. A graph read does not prove that its steps ran or that an external result occurred.

The projection preserves literal AI `askAi` and `run_agent` prompt inputs, including variable references, without returning full settings/auth. A saved Agent task input is marked separately and `agent_instructions_unverified:true` prevents claiming its saved Agent instructions were read. Unknown AI actions have no projected prompt. UI reads lazily on each opening, preserves editable conversation text and discards stale employee/panel responses. Read mode writes no instructions, Flow or Agent and never tests/publishes.


## Employee readiness receipt

`readiness_receipt` contains `employee_id`, `flow_id`, `published_version_id`, `test_run_id` and `test_environment:TESTING`. Optional `used_mock_trigger_data` is a Boolean from the native test response, not the run readback. The server verifies a fresh successful test for this owned Flow, unchanged business configuration, the exact tested version published and ENABLED, and the employee saved active. Old active state, missing proof, version/configuration changes or a failed state save cannot create a receipt.

Comparisons ignore only native test metadata: version `updated`/`updatedBy` and graph step `settings.sampleData`. Business inputs, prompt text, task variables and step references remain compared. Native lifecycle changes must not substitute a different version or configuration.

Only setup effects on this same Flow can produce `employee_ready`. A request with other effects keeps `unverified/unknown` and carries readiness independently. The UI retains the model reply, validates matching employee and Flow IDs, exposes TESTING evidence behind details, and excludes readiness from production work and KPI displays. TESTING may use mock trigger data and may execute real actions; readiness does not establish a production provider outcome.

After building or changing the owned Flow's published state, the model receives the unchanged native MCP result plus `siyadahContext` with the saved employee and any verified readiness receipt before writing its next reply. An unresolved state readback is marked `employeeStateVerified:false`; it does not supply a newly confirmed employee state. Publishing then pausing in one request must end with the saved employee disabled and no readiness receipt. The published MCP trigger's Wait for Response value accepts native `true` and `"true"` only; the owned published-version and exact tool-name checks remain required.

## Native employee production run receipt

The selected employee's native Flow MCP result may carry `structuredContent.execution` from Activepieces' existing `onRunCreated` callback: `runId`, `flowId`, `projectId`, `flowVersionId`, and `environment`. This identifies a created run, not a completed task. Siyadah accepts only its own project, saved employee Flow, current published version, and `PRODUCTION`, then reads that exact ID with scoped `ap_get_run`. Only `SUCCEEDED` with recorded steps and a durably saved, scoped request receipt produces `outcome:flow_completed` and `run_id` in the receipt. The employee result update preserves later configuration and newer runs as described below. Missing, mismatched, nonterminal, failed, or unsaved evidence remains unknown without repeating execution. The existing verification gate emits a scalar-only diagnostic reason and observed run status without logging provider content or credentials. Mixed effects remain unverified. Flow completion does not establish a generic provider or business KPI; provider results require their own native evidence.

## Durable native employee receipt recovery (ABO-37 / ABO-69)

Migration `0006-native-execution-identity.sql` adds nullable `execution_identity_json` to the existing company/request ledger. The server persists the native run/project/Flow/version/environment identity, employee ID and dispatch-time employee snapshot before run readback. Response expiry and settlement cannot remove this independent identity. No credentials, provider outputs or tool inputs are stored in this identity.

Native employee dispatch must be the sole effect in its chat request: prior attempted effects prevent dispatch, and after dispatch further effectful calls are rejected while read-only calls remain available. This keeps a confirmed native receipt from hiding mixed or ambiguous effects.

The existing authenticated `op=work` rechecks company/project/Flow ownership and reads only the exact native `ap_get_run` ID. `SUCCEEDED` with matching identity and recorded steps upgrades the ledger to `request_status:succeeded`, `work_status:succeeded`, `outcome_kind:tool_result` and `run_id`. It never invokes the Flow again, uses recent runs, or claims a provider KPI. Later Flow disablement/version publication does not invalidate ownership of the original execution.

Ledger and optional employee result updates share one atomic PostgreSQL statement. The employee update preserves status and requires the dispatch-time configuration `updated_at` plus request time ordering; a disabled, edited or more recently run employee remains unchanged. Saving a run result does not change configuration `updated_at`, so two already-dispatched requests retain their correct chronological order in either recovery order. Concurrent reconciliation is idempotent. The confirmed response keeps the native run identity and a readable output excerpt bounded to 5,000 characters. The new recovery helper stores only numeric status metadata in the existing employee result field for recent-work display; Activepieces remains the full-output source. Immediate settlement returns this receipt instead of a later model summary. A process failure before receiving/persisting native identity stays unverified. Without the new schema `/health` fails closed; rollback keeps the additive nullable column.

## Retired fixed-company Gmail pilot

The old company-43 recovery exception no longer runs in the production chat route. A read-only check on 6 October found no account, employee, chat request, tenant mapping, MCP grant or Flow for that historical pilot. Its verifier helpers remain under `scripts/support` for historical tests only. The existing general work ledger and project-scoped native MCP result paths serve every current company. This retirement deletes no data and adds no execution path.

## Native MCP construction and discovery boundary

Siyadah must not call direct REST endpoints to create/mutate Flows or discover pieces, actions, triggers, operation fields or auth fields. These capabilities belong to the company-scoped native MCP. Read-only Flow information/detail remains allowed for ownership and receipt validation; existing native authentication/project provisioning scope is unchanged. Existing connection management and pending OAuth completion remain distinct from tool/field discovery.

The authenticated legacy internal Flow creation route returns 410 `native_mcp_creation_required` without provider initialization. Employee status mutations use `ap_change_flow_status` over MCP and read back the owned Flow status before recording employee state. Unconfirmed native status returns an error without REST mutation fallback. Connection method preparation returns 409 `native_mcp_discovery_required` before HTTP until an original auth-schema contract is available; the dialog shows a plain availability error.

These boundaries are draft PR #60 behavior, not a production claim. See `docs/mcp-tool-discovery-boundary.md`.

## Native capabilities in main and employee chat

Both chat paths use the original company MCP tool catalog and schemas. Employee scope limits Flow/run identity, not an arbitrary whitelist of project action, table, record, AI or guidance capabilities. Native Flow creation for a Flow-less employee links its existing record and refreshes tool visibility for the next model turn. Existing linked Flows are edited. Flow-list text and structured data are limited to that employee, and run inspection/retry verifies the exact saved Flow before dispatch. Production employee Flow invocation still requires activation, exact native receipt and existing recovery boundaries. Local tests prove dispatch wiring, not live provider acceptance of every tool.


### Full native catalog exposure (draft PR #60)

Main and employee chat pass every protocol-valid tool advertised by the company MCP `tools/list` to the model, preserving native schemas and order without a fixed tool count. Employee state, linked Flow and continuation exclusions do not hide catalog entries. Company/project boundaries, employee Flow ownership, activation and duplicate-effect checks apply before dispatch. Project switching remains rejected; an existing draft cannot be replaced by another created Flow. This changes catalog exposure only, with no REST construction or discovery fallback and no claim that every tool has passed a live provider test.

## Native customer project membership

Customer MCP start first provisions the verified company project, reads exactly one verified owner email from the server account, and upserts an Activepieces PROJECT invitation with Editor role through the platform service API. Its returned email, project, type and ACCEPTED status must match before OAuth client registration. The browser still sends an empty body and chooses no identity/project/role. The customer signs in or registers with the same email in the native consent window and approves the intended company project; the callback remains bound to the original company session. This is project membership, not provider OAuth consent or an embedded SSO claim. Existing native project entitlement/seat checks remain authoritative.

### Model billing refusal

A provider HTTP402 before native execution produces a durable failed request explaining that the assistant service is unavailable due to its balance. Provider payloads and credentials are not exposed. Existing attempted-execution/unknown-result/transport-receipt precedence stays intact; no automatic redispatch occurs. ABO-69 / ABO-37.

A bounded instruction such as «لا تنفذ أكثر من مرة» limits repetition and is not a blanket do-not-run instruction. Independent explicit prohibitions remain enforced. This clarification fixes a witnessed pre-dispatch refusal; it does not itself add retry or deduplication behavior. ABO-69.

## Restoring a pending decision

`hydrate.pending_work` may include a saved `awaiting_input` response only when its native approval row still exists, belongs to the same company and conversation, and has not expired. It includes the existing customer-facing reply, approval and optional flow plan; no encrypted action arguments or unrelated response fields. The browser renders this decision without polling, dispatching or consuming it. The existing `approve` route remains the authority and rechecks expiry and ownership at action time. Restoring a decision does not grant MCP access or prove execution.

Restored decisions include `approval_expires_at` from the matched approval row. The browser rejects missing/expired timestamps and replaces the restored action controls when that deadline passes, without executing an API operation. The server expiry check still governs any submitted decision.

## Saved flow reply in recent work

A `recent_work` item may include `result: {schemaVersion: 1, source: 'flow_reply', content: string}`. It projects only a nonempty saved reply body with 2xx status and at most 12,000 characters; response headers are not exposed. No content is fabricated for metadata-only recovery records, missing bodies, non-2xx responses or oversized bodies. This is the saved flow reply, not independent proof of external delivery. The results page escapes its text and preserves all JSON table fields.

The employee space also presents these saved records as employee history, selected by the exact employee ID from the company-scoped hydration response. Earlier flow IDs remain historical and are labeled as an earlier workflow. This history does not establish a new request's outcome: exact request/conversation/run evidence remains separately checked in the current response. A conversation shortcut is offered only for an available conversation belonging to the employee or the main chat. Unknown, failed or pending records keep their saved status and do not display a successful flow reply.

## Tool activity while a request runs

Company knowledge supplied to both chat contexts uses the existing text-ranking helper from the consolidation branch before applying the knowledge-facts budget (40 whole facts, 6,000 JSON characters). The current request words and the selected employee's configured knowledge topics affect ranking. Fact keys, sources, source kinds, certainty and observed dates remain projected. A large fact may be omitted rather than truncated. This limits only the knowledge-facts array, not the entire prompt, and does not implement cumulative memory or establish that the model understood the facts.

`activity` is a bounded snapshot of up to 80 `{id, name, state}` records. An id identifies one native tool invocation; `started` is recorded immediately before the call, `returned` after its response, and `error` after a thrown error or `isError` response. No tool inputs, outputs or error details are included. Returned does not establish business success or delivery. The ledger writer requires the exact company/request/conversation/claim token and pending state. Failure to store activity does not retry or prevent the tool invocation.

Long chat requests return their existing queued work identity after 1.5 seconds instead of waiting 20 seconds. The browser reads that identity; these reads never dispatch another action. Pending `work` and hydration can carry stored activity, and the final reply retains the snapshot. This covers native calls made by the main and employee message loops; it is not a stream of each internal Activepieces flow step or model reasoning.

## Work that ends without a standing employee

For a new build in main chat without an existing employee draft, the model supplies `_siyadah_work_mode: one_off | standing` in the build tool schema. Siyadah removes it before native MCP dispatch. Missing mode is corrected before effects; customers do not choose a category. One-off builds do not call employee creation or employee state writers. They use an owned native MCP Flow that returns a response; continuous schedule triggers are rejected before activation. The current version must pass a verified test before publishing.

After publication, the server reads the exact owned published version and refreshes the native tool list. Before invocation it checks the same Flow, published version, activation and MCP tool identity again. A changed version blocks dispatch. One-off invocation follows the same native execution identity/readback mechanism and exact tenant/request ledger; one-off recovery does not update the employee table. Readonly inspection may precede building another goal in the conversation; old work is context rather than an automatic execution target.

This remains an unpublished local implementation. Its tests do not establish a production provider outcome, automatic understanding of all intentions, or customer-visible one-off records in the aggregate employee results page.

Native employee run reconciliation also retains only status and a successful, nonempty flow reply body up to 12,000 characters in the employee receipt. Object bodies are serialized once. Headers and other output fields remain outside this saved result. Oversized, empty, absent and non-2xx bodies retain status metadata only. Existing tenant, run, employee snapshot and ordering checks still guard the atomic write. This does not backfill earlier metadata-only receipts or establish external delivery.

Employee instruction application lets the model choose the suitable native piece, model and execution method, including preparing a missing step inside the owned employee Flow. Run Agent is required in the employee execution Flow; the surrounding Flow may use multiple branches and native tools as the task requires. Existing authorization, tenant/Flow ownership, explicit draft/no-run intent and tested-version activation checks remain enforced. Missing provider access is requested specifically; this policy does not grant access or prove execution.

The server supplies employee execution context only to native Flow tool parameters whose description explicitly declares `[siyadah:context]`. Object and string fields are supported; marked fields replace model-supplied values with the current owned request, company, employee instructions, settings, selected knowledge, conversation memory and bounded pre-request history. Unmarked business fields are unchanged. An invalid marked type blocks dispatch. This binding does not prove the Flow or Run Agent consumes the field, and does not implement a separate plan handoff phase.

## Native MCP capability receipt

`GET /siyadah-api/v1/mcp/catalog` requires the company session and reads only that company's existing OAuth grant. It never provisions a project, registers a client, changes permissions or executes a tool. The native `initialize` and all `tools/list` pages must succeed before `liveVerified:true` is returned. The receipt contains `observedAt`, `elapsedMs`, `toolCount`, sorted `toolNames` and `catalogSha256` for names, schemas and annotations; it proves discovery only, not execution permission or provider success. No tokens or connection values are returned.

Chat uses the same discovery routine. `chat_mcp_catalog` records native discovery and `chat_model_usage.tool_names` records tools actually sent to the model. `catalog_reviewed` requires a successful capability discovery tool response; listing tool definitions alone is insufficient.

Approval outcomes for native Flow builds and generic tool responses are explained through the same chat LLM without supplying execution tools again. Deterministic cancellation, validation, transport failure and recovery notices remain service status messages; they are not another conversational model or an Activepieces Saved Agent. The browser chat gateway is fixed to Siyadah's same-origin chat route.

## Model-to-native dispatch correlation

`chat_model_tool_choice` records the actual parsed `tool_calls` name, call id and SHA256 of arguments before scope guards. `native_mcp_dispatch` records `tools/call`, the configured native `/mcp` endpoint, name and SHA256 of the serialized dispatched arguments. Neither log records argument values or token/header values. Matching name and digest in a bounded request window proves unchanged inputs for that observed call. A mismatch may be an intentional scope binding or internal work-mode removal; it must not be called a transparent match. Dispatch logging precedes HTTP completion and is not a success receipt.
