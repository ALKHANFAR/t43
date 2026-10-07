# Provider policy research — 7 October 2026

Exa search: two search angles, five results requested each; four official pages fetched. Duplicate search hits were not treated as independent corroboration. Research establishes public policy wording, not settings or contractual protections on Siyadah's account. This is an engineering evidence note, not a legal certification.

## Findings and limits

| Official source | Finding | Consequence for this submission |
| --- | --- | --- |
| [DeepSeek Open Platform terms](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html) | The API-specific agreement incorporates the general Terms of Use and other platform agreements. Section 5.5 distinguishes developer end-user processing from the general privacy policy. Section 6.1 describes prepaid API billing. | Review incorporated terms as well as the API-specific page. Neither prepaid billing nor ownership of inputs/outputs is an API no-training guarantee. The founder's displayed balance does not establish a special plan or contract. |
| [DeepSeek Terms of Use](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html) | The displayed update is 27 March 2026. Section 1.1 includes APIs in the services. Section 4.3 permits limited use of de-identified inputs/outputs for service or underlying-technology improvement and describes disabling the setting named Improve the model for everyone. | This incorporated wording makes an API-specific account guarantee important. We have not verified where this setting exists for the API account, its scope, whether it is off, or whether a separate agreement overrides it. This does not prove that any Siyadah customer data was actually trained on. |
| [DeepSeek Responses API guide](https://api-docs.deepseek.com/guides/responses_api) | The compatibility table says store is unsupported and the response carries store:false; unsupported request parameters are silently ignored. | A store:false response does not certify retention, training restrictions or ZDR. The deployed t43 routes use Chat Completions, so Responses documentation also cannot establish the request semantics of those routes. |
| [Google Workspace user data and developer policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) | Limited Use applies to data obtained from both sensitive and restricted scopes. General model creation/training/improvement beyond the specific user's permitted personalized use is prohibited. An affirmative Limited Use statement is required. | Reducing scopes to gmail.send would not resolve the AI data-use question. The published statement must match implemented behavior; user consent and anonymization do not establish permission for general model training. |

## Draft API-provider inquiry — not sent

Recipient reference: api-service@deepseek.com, as listed in the Open Platform terms. The founder must authorize sending this separate inquiry. Do not include API keys, Google data, OAuth tokens or customer content.

Subject: Written API data-use confirmation for Google Workspace OAuth review

Hello DeepSeek API Support,

We operate Siyadah AI and need written confirmation of the protections applicable to our production Open Platform API account before allowing Google Workspace API data into model requests. Please confirm:

1. Whether API inputs, outputs, tool results and their derivatives are excluded from training, fine-tuning, evaluation or improvement of general/shared models and underlying model technologies; identify any exceptions.
2. Which contract, account plan and setting establish this restriction, and whether the setting referenced in section 4.3 of the general Terms of Use applies to Open Platform API requests. Please provide the exact dashboard path and API-specific scope of any opt-out.
3. Retention periods for API content, logs and cached content, including security/legal exceptions; whether ZDR is available to this account and what it covers. We will document retention separately from no-training.
4. Whether any subprocessors receive API content and whether the same restrictions bind them.
5. Which endpoints and model aliases the commitment covers, including the deployed /chat/completions route and deepseek-v4-pro/deepseek-chat; whether fallback models or routing alter these protections.
6. The effective date and a written agreement or official documentation we may provide to Google's verification reviewers.

Until these protections are verified or an alternative data path is implemented and tested, we cannot attest that the Google-data AI integration is ready for review.

Thank you,
Siyadah AI

## Decision gate

The Google reply remains blocked. A verifiable account/API agreement can resolve the provider-policy uncertainty; otherwise prepare and test a provider change or complete auditable isolation of Google data, including derived data and tool-result context. None of these alternatives is implemented by this documentation PR. Full flow inventory, correct OAuth-client scopes, matching live policy publication and a current demo remain separately required.
