# Google AI review — implementation and evidence handoff

Status: review preparation only. Do not send a completion claim, merge this PR to the watched branch, or publish the policy until the account and runtime checks below pass. Production was not changed.

## Original request and current release

Read the full 5 October Google message in Gmail thread `1a10b8dca3700d85`. It asks for every AI provider and actual plan, gateway/upstream/endpoints and no-training controls, self-hosted disclosure only if true, and a published Limited Use statement. If retaining an integration that trains on Google data, provide auditable isolation and a new demo. ZDR is an example control, not a universal requirement or equivalent to no-training.

Railway project `6df6cda2-2a7a-4895-a2ef-5c570190e5d6`, production, `siyadah-direct-ui`, deploy `30bc5fc3-3d15-4583-ad8e-8c9da5eba243` runs commit `a130a599765a3c02c311c62b5ec11ff6cfd9d14d`. The accounts privacy page comes from this app; the public domain is a separate LWS deployment. Activepieces and its worker are hosted in this Railway project. Neither fact establishes the runtime value of ACTIVEPIECES_URL or the Google OAuth route.

## Required work in order

1. Read the existing DeepSeek account's API plan and applicable developer agreement. Establish a no-training guarantee that covers raw, derived and aggregated Google data, including abuse/feedback exceptions. A consumer opt-out and `store:false` alone are insufficient evidence. If this cannot be established, select and verify a suitable provider or isolate Google data completely. Do not silently replace the model or assume a locally running lab is a local model.
2. Inventory all company-project flows, AI steps, gateways and downstream hosting providers without copying customer content or keys. Read only the non-secret ACTIVEPIECES_URL and SIYADAH_GMAIL_OAUTH_PROVIDER values. Verify actual Google project Branding/Data Access and consent scopes. Existing metadata-driven OAuth routes can request more than gmail.send. New tool setup is currently a recorded gap in the feature index after PR60; a fresh demo cannot be fabricated from the old pilot.
3. B owns any server contract/provenance/egress changes; record them in ABO-37, with C reviewing flow routing and A reviewing consent UI. Trace Google source data through tool outputs, stored history, knowledge, summaries, errors, feedback and retries. Do not treat filtering only `role:tool`, masking PII, tenant isolation, or a no-training boolean as complete provider isolation. Test both direct DeepSeek routes and AI steps inside flows. Gate unknown routes/fallbacks before release.
4. A must show an accurate, prominent Google data/AI-sharing notice immediately before consent, with the actual scopes and a policy link. Binding consent to the company and actual method/scopes is a shared contract change. Do not promise send-only when the gateway requests read scopes. Review draft policy below is not live. Publish matching approved policies on both domains and record fetched hashes. Confirm retention/deletion and Google grant revocation separately.
5. Record a continuous current-release demo using synthetic QA data: policy, prominent consent, Google's real scopes, user-directed action, actual provider result, app readback, disconnect/revocation and no-training/isolation evidence. Redact tokens and private content. Historical pilot artifacts remain historical.
6. Complete `ai-evidence.json` with reviewed evidence, exact released commit, reviewer, verifiedAt and validUntil per gate. Run `node scripts/google-review-readiness.mjs`; success only means the evidence fields are complete, not that Google approved or the provider's behavior is independently certified. Have a human review the underlying evidence before making a final claim.

## Ready-to-use Limited Use text, conditional on verified controls

English: Siyadah AI's use and transfer of raw or derived information received from Google Workspace APIs will adhere to the Google API Services User Data Policy and the Google Workspace API User Data and Developer Policy, including the Limited Use requirements. We do not use, sell, or transfer Google Workspace data to create, train, or improve foundational or generalized AI/ML models. Such data is processed only for the user-requested features disclosed in Siyadah and the permitted security and legal purposes.

العربية: يلتزم استخدام سيادة ونقلها للمعلومات الخام أو المشتقة المستلمة من واجهات Google Workspace بسياسة بيانات المستخدم لخدمات Google API وسياسة بيانات المستخدم والمطور لواجهات Google Workspace، بما فيها متطلبات الاستخدام المحدود (Limited Use). لا نستخدم بيانات Google Workspace أو نبيعها أو ننقلها لإنشاء نماذج ذكاء اصطناعي أو تعلم آلي تأسيسية أو عامة أو تدريبها أو تحسينها. تعالج هذه البيانات فقط للميزات التي يطلبها المستخدم وتُوضَّح في سيادة، ولأغراض الأمان والنظام المسموح بها.

This is proposed policy language. It is not proof the deployed DeepSeek account already honors it. Include the actual provider, plan, endpoint, processing location, retention, controls and withdrawal process in the final policy after validation.

## Evidence-first reply structure — not a send-ready completion claim

Dear Third Party Data Safety Team,

Thank you for your 5 October message. Please find our response mapped to your requested items:

1. Provider inventory and actual API plans: attach the verified inventory, including downstream hosting providers for any gateway.
2. Data handling: attach the applicable API no-training agreements and effective account settings, or the demonstrated isolation implementation. Include precise endpoints, model identifiers and fallback restrictions. Distinguish retention from training.
3. Self-hosted/offline models: state N/A only after verifying the complete inventory; the current direct DeepSeek route is an external API.
4. Limited Use: link both live approved policy pages and quote the verified published statement.
5. Current-release demo: link the new continuous recording and the release version used. Include user-visible consent and provider outcome evidence.

Only replace these instructions with verified facts after all gates pass. Ask whether the supplied evidence resolves the 5 October action items and whether further information is needed. Do not guarantee approval or timing.

## Primary references reviewed 7 October

- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html — effective 29 April 2026; downstream end-user personal information is not covered by its general privacy policy (5.5). This is not a verified API no-training guarantee.
- https://api-docs.deepseek.com/guides/responses_api — unsupported parameters can be ignored; `store:false` must not be represented as no-training or ZDR.
- https://siyadah-ai.com/privacy.html and https://accounts.siyadah-ai.com/privacy.html — publication must be checked again after an approved release.
