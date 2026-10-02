# Siyadah public-site and Google OAuth release gates

Status: evidence inventory, 2 October 2026. Track in [ABO-62](https://linear.app/abo-eyad/issue/ABO-62/tjhyz-sfhh-syadh-alaamh-wsyash-gmail-lqbwl-google). No public page has been changed by this package.

## Data and policy facts

| Path | Confirmed | Missing before a public promise |
| --- | --- | --- |
| Public waitlist | The LWS form collects contact and company fields and posts to an Activepieces Cloud webhook; it may open an email fallback. | Destination flow, further recipients, storage, geographical location, retention and destruction. The accessible Activepieces Cloud projects did not contain a matching waitlist flow. |
| Gmail pilot | The deployed Siyadah service requests `gmail.send`, creates a company-project connection in self-hosted Activepieces, and deletes that connection on disconnect. One private pilot send was previously proven. | Full consent-screen readback, whether disconnect revokes Google access, message/log and chat retention, deletion, and storage location. The pilot flow is now disabled. |
| Contact | Founder identified `شركة عشر أبعاد لخدمات الأعمال`. A 2026 articles-of-association document shows the same name. `info@siyadah-ai.com` has received inbound mail. | Named person/team and response process for privacy requests. |

Google asks the published policy to describe access, use, storage and sharing of Google data. Saudi SDAIA's privacy-policy guidance also calls for the controller, purpose and legal basis, disclosure recipients, geographic processing scope, retention period or criteria, destruction, rights and complaints path. A draft with these facts missing must remain marked as a draft. [Google verification requirements](https://support.google.com/cloud/answer/13464321?hl=en) · [SDAIA privacy policy guidance](https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/ElaborationandDevelopingPrivacyPolicyGuideline)

## Public homepage claims needing correction or proof

The current LWS English and Arabic pages display:

- `seatsClaimed: 390`, explicitly marked illustrative in source, as a live counter; the countdown deadline was 30 September 2026.
- Four departments labeled Live and a claim that a working team starts in three minutes; this is a private pilot, and the general customer run is not proven.
- 50% permanent pricing and a lifetime founder rate, without verified commercial terms in this release review.
- End-to-end encryption, SOC 2-aligned infrastructure, data residency options and no model training by any provider, without the provider-by-provider evidence needed for the published claim.

Before Google brand review, replace or qualify these visible claims and preserve the existing site's layout. Never upload an older t43 landing page over the LWS source. The Google homepage must accurately describe the submitted app and link the same published privacy URL as the OAuth consent screen.

## Order to finish

1. Identify the owner of the live waitlist webhook and read its actual flow and data destinations. Confirm Google and Activepieces retention/deletion; put the true details in `privacy.html`.
2. Assign the privacy-response owner. Final factual and legal review of the bilingual `privacy.html` and `terms.html`; remove draft banners and `noindex` only from approved copies.
3. Prepare corrected copy for the actual LWS pages, compare with fresh live hashes, and publish the approved pages and links together. Check them anonymously in both languages.
4. Set Google Branding to the exact published privacy and terms URLs. Retry brand review after Google's 24-hour ownership wait, then read the Verification Centre result.
5. With the pilot enabled only for a controlled test, capture the real Google consent and requested send end-to-end; produce the YouTube evidence and submit the `gmail.send` scope review. Keep a run ID, provider message ID and customer-visible result separate.
