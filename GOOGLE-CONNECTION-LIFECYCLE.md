# ABO-63: Google connection lifecycle

## Meaning of each action

- **Disconnect one tool in one company:** check every draft and published Flow version, then delete only that company's project connection if no version uses it. Current behavior returns HTTP 409 when a dependency exists; it does not stop or edit that Flow. This does **not** revoke the Google grant. Keep the Flow and work history.
- **Disconnect Google from one company:** stop every Google connection and dependent Flow in that company. Report the Google grant separately; a project-wide Google revocation can affect the same Google user in other companies.
- **Revoke Siyadah's Google grant:** revoke a token at Google's endpoint only after inventorying the affected Google account across all Siyadah company projects and showing the full impact. A successful Activepieces DELETE is not proof of Google revocation.

## Current evidence and boundary

The production Gmail pilot uses only `gmail.send`. Its project connection has no `metadata.accountIdentifier`, and the Activepieces API omits `value`. Thus Siyadah cannot currently prove which other connections belong to the same Google account or revoke from its API. Activepieces 0.92.1 stores OAuth tokens internally and its connection DELETE removes the record without calling Google. The account-wide action stays unavailable.

Google states that revoking a token removes all OAuth grants for that user and Google Cloud project, including grants to other clients in the project. It can take time to become fully effective. [Google revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke). Gmail `users.getProfile` does not accept `gmail.send`, so account discovery must not silently add a mailbox scope. [Gmail profile scopes](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile).

## Implementation gate

1. Keep the current Gmail consent and review unchanged while Google verification is pending. For future connections, obtain a provider-verified account subject with an identity scope only after reviewing the new consent and its Google review impact; never group accounts from a typed email or connection display name.
2. In Activepieces, expose a narrow project-owned operation that can use its stored token to revoke the grant without returning or logging that token. Record Google's HTTP result and failure code, not the credential. First prove this in an isolated test account.
3. Before revocation, inventory all project-exclusive Google connections for that subject across companies and all DRAFT/LOCKED Flow references. Show an aggregate impact count without disclosing another company's identity or work. If identity, inventory or impact is incomplete, stop without revoking. Never erase Flow history to make the inventory pass.
4. Stop dependent execution before revocation. After Google's result, read back each affected connection and Flow state. If any step fails, preserve an explicit partial state and a retry path; do not display "disconnected" as a blanket success.
5. Test two companies sharing one Google account, two Google tools, a published Flow with a newer draft, a provider failure, and an interrupted retry before enabling the customer action.

The runtime implementation remains a gap. This document is the release gate, not a claim that account-wide revocation works.

## Confirmed single-tool disconnect — proposed branch

When the customer selects **Disconnect** for one tool, Siyadah first shows a short warning and offers **Cancel** or **Disconnect tool**. The confirmed request inventories that company's draft and published Flow versions, pauses enabled dependent Flows using Activepieces `CHANGE_STATUS`, verifies each pause, then deletes only that project's connection. The Flow definitions and work history remain. Existing in-progress runs may be affected; the warning says so. A failed pause prevents deletion. If deletion fails after a pause, the response reports partial completion rather than success. Incomplete inventory or project ownership still blocks the operation. This action does not revoke Google's account-wide OAuth grant or disconnect other Google tools.

This branch has local tests only until reviewed, merged, deployed, and exercised in a customer account. The full-account Google action above remains a separate gap.
