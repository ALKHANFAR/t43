# Google verification submission — prepared, not submitted

## Post-deploy update, 2 October 2026

The Siyadah waitlist API is now deployed from t43 commit `4cc473fe84e49c1dc4d38679b15178c65203b062` in Railway deployment `889aca55-5206-4f61-9964-348d1f3bb973` (`SUCCESS`). A synthetic request returned HTTP 202, was read back as one PostgreSQL row, and was deleted. The **published LWS homepage has not switched to that API**, and its root privacy and terms URLs still return 404. The founder has deferred LWS access. Do not submit Branding or `gmail.send` review while the public homepage and configured privacy URL disagree. The older server SHA and deployment listed below are a historical pre-release snapshot.

The current app UI does not yet present a prominent Gmail privacy link / notice at connection time. Carry this into the page-level frontend redesign and verify it in the Google demonstration. Google's [verification requirements](https://support.google.com/cloud/answer/13464321?hl=en) require a discoverable in-product privacy notice as well as the same published privacy URL on the homepage and OAuth consent screen. The demo must show the exact consent screen in English and the feature using the requested scope. No video URL has been submitted.

## Current state on 2 October 2026

- Search Console domain ownership: **verified** for `siyadah-ai.com`.
- Branding: **not shown to users**. Google's previous-attempt issue panel says to wait 24 hours after ownership verification before retrying. The previous issues also refer to an outdated `preview.siyadah-ai.com/privacy` URL and a former homepage; inspect the current published pages before selecting “I have fixed the issues.”
- Data access: `gmail.send` is listed as **Sensitive / not yet verified**; Restricted has no rows. `userinfo.email`, `userinfo.profile` and `openid` also appear as non-sensitive scopes; identify their actual uses before removing or justifying them. The scope justification is empty and the YouTube field currently contains an invalid email address with unsaved changes. Do not submit it as a video URL.
- Production callback app: `accounts.siyadah-ai.com` → Railway `siyadah-direct-mcp-lab / production / siyadah-direct-ui`, deployment `9f9f72b3-fdcd-4c75-9b94-8ae084019c15`, t43 commit `f438303c1baa205080fa7534190f17c1b8d69e5a` in `sfo`. That code requests `gmail.send` explicitly. Activepieces API and worker are self-hosted in the same project, from `ALKHANFAR/siyadah-activepieces-092-cors` commit `3911d7f37040fe21d690c22bdd23d43badfaa332` (base image Activepieces 0.92.0).
- A read-only provider readback found the Gmail connection `ACTIVE` and exclusive to the pilot project, but its published flow `DISABLED`. That project has `executionDataRetentionDays: null`, which refers to the instance setting; no explicit `AP_EXECUTION_DATA_RETENTION_DAYS` variable is set. The documented self-hosted default is 30 days, but cleanup of this installation and prior chat retention have not been proven.
- Public site: existing LWS waitlist pages have no privacy/terms links. A local review patch and draft policies are in this directory. They are not approved or published.

## Draft scope justification (use only after the actual customer flow and demonstration are ready)

> In Siyadah's private pilot, a user explicitly connects a Gmail account and requests a specific email send from that account. Siyadah uses `gmail.send` to send that requested message through Gmail and show the resulting message status in the company workspace. We do not request inbox-reading, contact-reading, mailbox-management or draft-management scopes for this feature. A narrower profile or email identity scope cannot send mail on the user's behalf. We will submit a video of the same application showing the user action, the complete Google consent screen, the send request and the result.

The present proven send is a single company pilot; verify a representative user journey before making this a general-production claim. Do not enter the draft in Google while the public disclosure and video are incomplete.

## Demonstration evidence needed

1. The public homepage, privacy and terms pages on the verified domain, and the same privacy URL in Google Branding.
2. A real Siyadah company user opening the Gmail connection in the product, the complete Google consent screen in English with app name, browser URL/client ID and `gmail.send`, and affirmative authorization.
3. The user requesting a specific message, Siyadah showing the request and result, and an Activepieces run plus Google message ID. Show the outcome accurately: a Google message ID proves acceptance for sending, not delivery to the recipient by itself.
4. A disconnect action and the resulting UI state. Distinguish connection deletion from token revocation and deletion of prior logs.

Google's [verification guide](https://support.google.com/cloud/answer/13464321) and [sensitive-scope guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) require an end-to-end demonstration of the same app and requested scope. Publish branding first; then request sensitive-scope verification.
