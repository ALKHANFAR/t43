# Google review package for the current LWS public site

Status: **review drafts; do not publish or submit to Google yet**. Related issue: [ABO-62](https://linear.app/abo-eyad/issue/ABO-62/tjhyz-sfhh-syadh-alaamh-wsyash-gmail-lqbwl-google).

Start with [release-gates.md](release-gates.md) for the current evidence and factual gaps. [submission.md](submission.md) holds the unsubmitted Google justification and video checklist.

## Source and change

The actual English and Arabic pages were downloaded read-only on 2 October 2026 from LWS cPanel's `/home/c1983949c/public_html/siyadah-ai.com/`. The live English `index.html` SHA-256 was `8f3e842bb51b73e200cae104819cfd98e4984753ad2afdae08a7cd22fa256880`; the Arabic `ar.html` SHA-256 was `d8cd883d83471a13f749309ad40bd1dcdd72a9f4b7fc220576f95ffe0e6292e7`. Local provenance snapshots are in the task artifact `artifacts/lws-public-site-20261002/`.

`public-site-links.patch` changes only two lines per page: it adds a truthful explanation of the optional Gmail private pilot near the waitlist, and privacy and terms links in each footer. It excludes the rest of the live site because the current static HTML contains a nonempty workflow endpoint. Do not copy the live page into Git or replace it with this repository's older landing page.

`privacy.html` and `terms.html` are bilingual review drafts with visible warnings and `noindex,nofollow`. They are **not approved legal pages** and must not be uploaded unchanged. Their contents were derived from the actual public form and the draft Gmail connection path, with unknowns left explicit.

## Gates before publication

1. The production callback service and provider are now mapped: `accounts.siyadah-ai.com` belongs to `siyadah-direct-mcp-lab / production / siyadah-direct-ui` on `ALKHANFAR/t43` commit `f438303c1baa205080fa7534190f17c1b8d69e5a` in Railway `sfo`; Activepieces API and worker run in that same project. The deployed code requests `gmail.send`. The pilot Gmail connection is active and exclusive to its project, but the flow is disabled; the project has no run-retention override. Still verify the scope shown in live Google consent, actual token/run-log cleanup, message storage, deletion on disconnect, and storage location. A single company pilot send is proven; general customer use is not.
2. The live waitlist pages point to an Activepieces Cloud webhook. Verify that flow's downstream processors, storage, backups and deletion, plus the person and process responsible for privacy requests. The public form can open an email fallback if submission fails. Do not confuse this Cloud waitlist with the self-hosted Activepieces instance used for the Gmail pilot.
3. The founder supplied the operator name `شركة عشر أبعاد لخدمات الأعمال`. Its articles of association in Google Drive (`[قانوني] عقد تأسيس عشر أبعاد.pdf`) show the same company name. The founder selected `info@siyadah-ai.com` for privacy contact, and the connected Siyadah mailbox has received messages addressed to it. This confirms a receiving mailbox, not a privacy request response process. Review and approve legal rights, retention wording, processor disclosure and service terms. Remove draft warnings and set the real effective date only after approval.
4. Check the public site's existing claims about encryption, model training, SOC 2, data location, live features, seats and pricing against evidence. Amend unsupported claims before Google submission.
5. Apply the patch only to the **same LWS source** after comparing current live hashes, and upload the approved policies and both pages together. Confirm anonymous HTTP 200, English/Arabic links and the policy text. Then set Google Branding to the exact same privacy URL shown on the homepage.
6. Google's prior branding notice instructs waiting 24 hours after domain ownership verification before retrying. A successful domain check does not prove branding or `gmail.send` approval. Prepare a real OAuth and send demonstration video for the sensitive-scope review.
