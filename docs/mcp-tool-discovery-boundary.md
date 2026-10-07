# Tool discovery boundary

Tool discovery, action/trigger schemas, operation fields and Flow construction use the company's native Activepieces MCP session. The existing discovery allowlist includes `ap_research_pieces`, `ap_search_actions`, `ap_search_triggers`, `ap_get_piece_props`, `ap_resolve_property_options` and `ap_resolve_property_chain`. No REST catalog/schema fallback is allowed.

The legacy pilot REST inventory is closed. Connection consent is a separate control-plane operation: it reuses Activepieces piece authentication metadata and its OAuth apps, with company-owned PROJECT connections. Only name/version/display name/auth are retained from that metadata response; actions, triggers and operation schemas are not used as a REST discovery fallback. This restores the existing connection journey from ABO-61 instead of duplicating authentication or execution engines. The customer still completes provider consent. The earlier unconditional auth-metadata rejection also blocked this journey and has been removed on the isolated consolidation branch.

Existing company-owned connection inventory, OAuth callback completion and connection lifecycle safeguards remain in place. Native authentication and project provisioning keep their existing scope; this change does not redefine them. Flow information/detail reads are handled separately. No new discovery resolver or execution engine was added.

Validation is local: tests keep action/Flow discovery on MCP and exercise the restored Activepieces connection consent path and preserve connection ownership, pagination and disconnect protections. They do not prove live native discovery or all catalog integrations.

The internal `POST /internal/v1/tenant-flows/create` route requires internal authentication then returns 410 `native_mcp_creation_required`; it never initializes a provider. The tenant-project adapter exposes no Flow mutation methods. Employee activation/deactivation uses `ap_change_flow_status` over the company MCP session and checks the owned Flow status through read-only REST before saving local state. Native publish remains `ap_lock_and_publish`. A missing MCP grant or unconfirmed status cannot fall back to a REST mutation.

This restriction concerns Siyadah's direct REST calls; Activepieces may use its own internal services behind the native MCP tools.

## Native capabilities in both chats

Both chats derive tools and input schemas from the actual company MCP `tools/list`, and pass calls through the same native client. Employee chat no longer uses a static discovery/edit whitelist to hide project tools: actions, tables, records, fields, AI models and setup guides retain native schemas and project RBAC. A paused employee can prepare or use a requested project action; invoking its published production Flow still requires activation.

Employee Flow tools inject the saved Flow ID and reject a conflicting one. `ap_get_run` and `ap_retry_run` verify the native run ID and Flow ownership before returning/dispatching the selected call, including stored approval paths. `ap_list_flows` results are reconstructed in text and structured form to contain only the selected employee Flow. Other employees' published MCP Flow tools and project switching remain unavailable.

For a saved employee without a Flow, `ap_build_flow` or `ap_create_flow` uses the existing build lock, native creation and owned readback, then links the same employee record. Available model tools are regenerated after linking, so the next turn can edit the new Flow without starting a second one. A linked employee edits its existing Flow. No native capability is fabricated when absent from the actual list.

Local scripted-model tests exercise real server dispatch for project actions, tables/AI reads, linked creation/editing, filtered listing and rejected foreign-run retry. They do not prove all tools are entitled, connected or successful in production. Connection auth-form preparation uses the existing Activepieces authentication metadata path described above, independently of MCP action/trigger discovery.

`ap_duplicate_flow` uses the employee's saved Flow as its source. Its new Flow is an independent company artifact; it does not replace or become a second linked Flow for that employee. The tool result explicitly reports the unchanged employee link. When native deletion is accepted, Siyadah pauses the employee and retains its historical Flow reference. This prevents further local production invocation without claiming that asynchronous native deletion has finished. No production invocation is claimed without an owned published Flow and exact native receipt.
