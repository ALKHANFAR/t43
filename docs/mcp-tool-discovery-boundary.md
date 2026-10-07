# Tool discovery boundary

Tool discovery, action/trigger schemas, operation fields and Flow construction use the company's native Activepieces MCP session. The existing discovery allowlist includes `ap_research_pieces`, `ap_search_actions`, `ap_search_triggers`, `ap_get_piece_props`, `ap_resolve_property_options` and `ap_resolve_property_chain`. No REST catalog/schema fallback is allowed.

The legacy pilot REST inventory is closed. Connection method preparation previously read auth fields from REST piece metadata. Draft PR #64 now asks the company's native `ap_setup_guide` for a versioned structured auth schema. Paired [Activepieces PR #4](https://github.com/ALKHANFAR/siyadah-activepieces-092-cors/pull/4) adds that schema to the existing project-scoped tool while preserving its text. If the image has not been deployed or returns a missing, malformed, or foreign piece schema, Siyadah returns `native_mcp_discovery_required` (409) before creating a connection. There is no REST metadata fallback. Provider consent remains a separate customer action.

Existing company-owned connection inventory, OAuth callback completion and connection lifecycle safeguards remain in place. Native authentication and project provisioning keep their existing scope; this change does not redefine them. Flow information/detail reads are handled separately. No new discovery resolver or execution engine was added.

Validation is local: tests prove zero REST metadata requests, schema/project checks and existing connection ownership, pagination and disconnect protections. They do not prove live native discovery, provider consent or a working customer connection until the paired image and Siyadah PR are deployed and tested together.

The internal `POST /internal/v1/tenant-flows/create` route requires internal authentication then returns 410 `native_mcp_creation_required`; it never initializes a provider. The tenant-project adapter exposes no Flow mutation methods. Employee activation/deactivation uses `ap_change_flow_status` over the company MCP session and checks the owned Flow status through read-only REST before saving local state. Native publish remains `ap_lock_and_publish`. A missing MCP grant or unconfirmed status cannot fall back to a REST mutation.

This restriction concerns Siyadah's direct REST calls; Activepieces may use its own internal services behind the native MCP tools.

## Native capabilities in both chats

Both chats derive tools and input schemas from the actual company MCP `tools/list`, and pass calls through the same native client. Employee chat no longer uses a static discovery/edit whitelist to hide project tools: actions, tables, records, fields, AI models and setup guides retain native schemas and project RBAC. A paused employee can prepare or use a requested project action; invoking its published production Flow still requires activation.

Employee Flow tools inject the saved Flow ID and reject a conflicting one. `ap_get_run` and `ap_retry_run` verify the native run ID and Flow ownership before returning/dispatching the selected call, including stored approval paths. `ap_list_flows` results are reconstructed in text and structured form to contain only the selected employee Flow. Other employees' published MCP Flow tools and project switching remain unavailable.

For a saved employee without a Flow, `ap_build_flow` or `ap_create_flow` uses the existing build lock, native creation and owned readback, then links the same employee record. Available model tools are regenerated after linking, so the next turn can edit the new Flow without starting a second one. A linked employee edits its existing Flow. No native capability is fabricated when absent from the actual list.

Local scripted-model tests exercise real server dispatch for project actions, tables/AI reads, linked creation/editing, filtered listing and rejected foreign-run retry. They do not prove all tools are entitled, connected or successful in production. The current production image still lacks structured auth-form output; the paired Activepieces patch must be deployed before the new connection path can work live.

`ap_duplicate_flow` uses the employee's saved Flow as its source. Its new Flow is an independent company artifact; it does not replace or become a second linked Flow for that employee. The tool result explicitly reports the unchanged employee link. When native deletion is accepted, Siyadah pauses the employee and retains its historical Flow reference. This prevents further local production invocation without claiming that asynchronous native deletion has finished. No production invocation is claimed without an owned published Flow and exact native receipt.
