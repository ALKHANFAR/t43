# Native connection transfer into t43

Source: Siyadah-VF a1251063895f5b0d632a289211ed8fedef8575ff, project-scoped auth schema in deployed Activepieces c92aec3f0533b1c76b3a0de295047024318a3dd6 (official image 0.92.1). Target: existing t43 consolidation PR62, parent 3337ae1. This is code transfer, not live provider acceptance.

## Ownership

Activepieces owns piece definitions, OAuth token exchange/refresh, PROJECT connections and Flow execution. Siyadah resolves company/project from its verified session, prepares the connection UI and reads results. Tool definitions now use only `ap_setup_guide`; REST remains the existing connection control plane. Existing trace, approvals, OAuth callback/attempt consumption, connection paging, and confirmed MCP pause-before-disconnect behavior are retained. No gateway, queue, alternate LLM or execution engine was copied from VF.

## Explicit QA activation

t43 has no VF quota/tenant-flag service. To avoid importing that architecture merely to test this adapter, `SIYADAH_NATIVE_MCP_COMPANY_IDS` is an exact comma-separated server-side company-ID opt-in, empty by default. It has no wildcard/global enable. This replaces the VF `native_mcp_auth` selector only; it does not constrain available tools or model choices. `ACTIVEPIECES_OPERATOR_EMAIL` and `ACTIVEPIECES_OPERATOR_PASSWORD` must exist only in the approved QA server secrets. Do not copy production secrets into QA. Project tokens are short-lived in process memory, never returned to the browser.

Enabled native mode does not fall back to stored grants when credentials or provider access fail. `authMode: native` remains explicit on status, including project_required. A missing project is provisioned only after the user's connection action using the existing verified-company provisioner; no ensureMember/register/authorize is called in native mode. `authorization_stored` requires mint + valid nonempty tools/list, not the opt-in alone. The label preserves frontend compatibility; it does not mean a persistent OAuth grant was written.

The native module enforces HTTPS without URL credentials, rejects redirects, validates USER sign-in and project-scoped mcp_oauth claim/endpoint/lifetime, coalesces minting and drops a rejected token. Only HTTP401 retries once. Trace IDs and argument hashes remain preserved. Approval encryption still requires the existing session secret. The browser suppresses Activepieces consent buttons in native mode; actual provider consent (e.g. Google) still opens from the submit gesture.

## Limits and rollback

Client-credentials-only OAuth remains unsupported; this transfer does not claim every integration works. The deployed structured schema omits tokenUrl, defaults and dynamic resolver declarations. Additional source-contract matching is needed before adding those capabilities. No live connection, token expiry, two-company isolation or employee result is claimed by synthetic tests.

Removing a company from the opt-in returns it to legacy stored-grant auth after deployment/restart. A company without a legacy grant must complete legacy consent; rollback does not imply uninterrupted access. Existing in-flight OAuth callbacks can complete without rediscovering metadata.

## Release hold discovered during work

Read-only Railway evidence at 2026-10-10 19:38 Riyadh showed production siyadah-direct-ui is now connected to this consolidation branch and runs 3337ae1, deployment f1d3ac08-109d-4943-a4d0-f673ab77ea99 created 16:02:39 UTC. This session did not deploy that production change. Because a branch update could trigger production deployment and the user forbids production changes, do not update the branch ref until its deployment isolation is proven or explicitly authorized. QA remains separate.

## Acceptance still required

1. Dedicated QA credentials and company opt-in; exact deployed SHA evidence.
2. OPERATOR sign-in from server secrets; project token + tools/list; no secrets in receipts.
3. Two synthetic projects: own read/write/readback/restore, foreign request rejected with all baseline data unchanged.
4. Actual connection from Siyadah chat, provider consent only, Activepieces PROJECT/ACTIVE readback, no workspace consent on success or failure.
5. Same employee draft, linked Flow, explicit execution approval and exact run/provider-result proof. Synthetic tests do not close these gates.
