# Siyadah public-site and Google OAuth release gates

Status: server released; public LWS site and Google review pending. Updated 2 October 2026. Track in [ABO-62](https://linear.app/abo-eyad/issue/ABO-62/tjhyz-sfhh-syadh-alaamh-wsyash-gmail-lqbwl-google). No LWS page has been changed by this package.

## Current release readback (supersedes the pre-deploy inventory below)

- PR [#25](https://github.com/ALKHANFAR/t43/pull/25) and [#26](https://github.com/ALKHANFAR/t43/pull/26) merged in order into Railway's watched t43 branch `codex/abo-38-isolation-gate-20261001`. Its head is `4cc473fe84e49c1dc4d38679b15178c65203b062`.
- Railway `siyadah-direct-ui` production deployment `889aca55-5206-4f61-9964-348d1f3bb973` reports `SUCCESS` for that exact SHA. `/health` returned HTTP 200. A controlled POST to `/siyadah-api/v1/waitlist` returned HTTP 202; a separate PostgreSQL read found exactly one corresponding synthetic row, which was then deleted (one row). This proves the deployed route and durable write/readback. It does not prove the LWS browser form.
- `npm test` passed locally on Node 22.23.3 (223/223 runtime checks, 14 indexed features and 94 anchors, plus syntax, catalog, HTML and accessibility checks). GitHub Standards jobs did **not start** due to the account billing lock; that is neither passing CI nor a failing code test.
- The live public site still points its form to the old Activepieces Cloud webhook. Root `/privacy.html` and `/terms.html` returned 404. The prepared corrected bilingual site and policy files remain local. LWS requires a new-device email code after an IP change; the owner has deferred that access. Do not bypass it or describe the site as migrated.
- The current app files do not expose a prominent Gmail privacy link or notice at connection time. Include the published policy link and notice in the upcoming page-level frontend design before recording the Google demonstration.

The sections below are the **historical pre-deployment inventory**. Use the current release readback above for today's server state; use the inventory below for the unresolved data-flow and public-copy review.

## Data and policy facts

| Path | Confirmed | Missing before a public promise |
| --- | --- | --- |
| Public waitlist | The **published** LWS form collects contact and company fields and posts to an Activepieces Cloud webhook; it may open an email fallback. A new Siyadah database route and page switch are drafted locally, not deployed. | Old destination flow and recipients; new route deployment and real database readback; storage location, backups, retention and deletion. The accessible Activepieces Cloud projects did not contain a matching waitlist flow. |
| Gmail pilot | The deployed Siyadah service requests `gmail.send`, creates a company-project connection in self-hosted Activepieces, and deletes that connection on disconnect. One private pilot send was previously proven. | Full consent-screen readback, whether disconnect revokes Google access, message/log and chat retention, deletion, and storage location. The pilot flow is now disabled. |
| Contact | Founder identified `شركة عشر أبعاد لخدمات الأعمال`. A 2026 articles-of-association document shows the same name. `info@siyadah-ai.com` has received inbound mail. | Named person/team and response process for privacy requests. |

## Server and browser readback, 2 October 2026

PR #26 code at `585f6e3` passed the full repository `npm test` locally with Node 22.23.3, matching `.nvmrc`: 223/223 runtime tests, feature index (14 features / 94 anchors), JavaScript syntax, catalog, HTML validation, and accessibility 100/100 on ten Chrome pages. This is local evidence, not a production database migration or customer submission. The GitHub Standards check did not start: its check-run annotation says, `The job was not started because your account is locked due to a billing issue.` Do not label that check as a failing code test or a successful CI run.

The production Postgres credential available through Railway's public database URL was used for a **rolled-back transaction only**: it confirmed `CREATE` permission, applied the exact waitlist migration, inserted one synthetic row, deleted it with the 90-day purge, then rolled the transaction back. A final read confirmed the waitlist table did not persist. No customer row was read, written, or removed. This proves SQL compatibility and privilege in the current Postgres instance, but it does not prove a released migration, browser submission, durable readback, or recovery from backup. The internal `postgres.railway.internal` hostname is not reachable from the local machine; the public database URL was used without printing credentials.

Railway CLI access to `siyadah-direct-mcp-lab / production` was confirmed. Its `Activepieces`, `activepieces-worker`, and `siyadah-direct-ui` latest deployments each report `SUCCESS` (deployment IDs `4a303c2a-afa6-4bbd-a895-638c2ad6c0da`, `97be2747-2a0c-472a-bb36-4516923aa74d`, and `9f9f72b3-fdcd-4c75-9b94-8ae084019c15`). The self-hosted API service has `AP_EDITION=ee`, `AP_ENVIRONMENT=prod`, S3 file storage, and no explicit `AP_EXECUTION_DATA_RETENTION_DAYS` variable. The Siyadah UI service has no `SIYADAH_WAITLIST_WEBHOOK_URL`, so the existing `/siyadah-api/v1/waitlist` proxy is not configured to forward a lead. Variable values that could contain credentials were not copied into this package.

A subsequent Railway readback on 2 October confirms `siyadah-direct-ui` production deployment `9f9f72b3-fdcd-4c75-9b94-8ae084019c15` is from `ALKHANFAR/t43` commit `f438303c1baa205080fa7534190f17c1b8d69e5a`. That commit is an ancestor of PR #26 head `2e634544a3f23c7254bbcf6587046f3d8ce57481`, which is 14 commits ahead and remains Draft. The Postgres deployment reports region `sfo` and Railway PITR reports `enabled: false`, `bucketWired: false`. Its active volume has no scheduled backups; one platform-created snapshot expires 20 October 2026. An attempt to set daily and weekly backups through the API returned `Not Authorized`, and the authenticated Railway Backups page explicitly states that new backups and PITR require the Pro plan. No backup schedule was changed. Do not promise an active backup process in the policy. The founder selected 90 days for active waitlist retention; the draft app now purges expired rows hourly, but this code is not deployed.

Skyvern opened the saved authenticated Activepieces Cloud profile. In `سيادة — إثبات التشغيل`, nine visible automations were listed; searching `waitlist` returned no results. In `Personal Project`, the same search returned no results. This search does not prove that the public webhook's flow does not exist in another account or under an unrelated name. It does show that the saved Cloud profile has not yet identified its owner or downstream storage. The browser session was closed after the read-only inspection.

The founder clarified that the Cloud account and the paid, self-hosted instance are separate, and that Siyadah should rely on the server instance for product execution. The draft implementation moves the public form to Siyadah's own database and keeps self-hosted Activepieces for product execution. This is not proof that the live LWS waitlist has been migrated. Keep the existing public destination in the current-data-flow disclosure until the replacement is deployed and an actual submission is read back.

Google asks the published policy to describe access, use, storage and sharing of Google data. Saudi SDAIA's privacy-policy guidance also calls for the controller, purpose and legal basis, disclosure recipients, geographic processing scope, retention period or criteria, destruction, rights and complaints path. A draft with these facts missing must remain marked as a draft. [Google verification requirements](https://support.google.com/cloud/answer/13464321?hl=en) · [SDAIA privacy policy guidance](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/ElaborationandDevelopingPrivacyPolicyGuideline)

## Public homepage claims needing correction or proof

The current LWS English and Arabic pages display:

- `seatsClaimed: 390`, explicitly marked illustrative in source, as a live counter; the countdown deadline was 30 September 2026.
- Four departments labeled Live and a claim that a working team starts in three minutes; this is a private pilot, and the general customer run is not proven.
- 50% permanent pricing and a lifetime founder rate, without verified commercial terms in this release review.
- End-to-end encryption, SOC 2-aligned infrastructure, data residency options and no model training by any provider, without the provider-by-provider evidence needed for the published claim.

The local public-site patch replaces or qualifies these visible claims while preserving the existing site's layout. It has passed a dry-run apply against the downloaded live source but is not published. Never upload an older t43 landing page over the LWS source. The Google homepage must accurately describe the submitted app and link the same published privacy URL as the OAuth consent screen. The current live page also exposes the Cloud workflow endpoint in client-side source. The proposed pages call only Siyadah's database-backed API and require deployment plus an actual waitlist readback before that implementation boundary can be claimed.

## Order to finish

1. Deploy the Siyadah waitlist migration and API, submit one controlled request and read its row back. Confirm database location, backups, retention/deletion and the responsible privacy-response owner. Record the current Cloud webhook's data path as the transition baseline.
2. Final factual and legal review of the bilingual `privacy.html` and `terms.html`; remove draft banners and `noindex` only from approved copies, and set the effective date at approval.
3. Review the prepared corrected copy for the actual LWS pages. Compare with fresh live hashes, then publish the approved pages and links together. Check them anonymously in both languages and confirm the browser sends only to Siyadah and sees success only after database acceptance.
4. Set Google Branding to the exact published privacy and terms URLs. Retry brand review after Google's 24-hour ownership wait, then read the Verification Centre result.
5. With the pilot enabled only for a controlled test, capture the real Google consent and requested send end-to-end; produce the YouTube evidence and submit the `gmail.send` scope review. Keep a run ID, provider message ID and customer-visible result separate.
