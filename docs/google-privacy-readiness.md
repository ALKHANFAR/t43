# Siyadah Google privacy readiness — review draft

Status: **draft for factual and legal review; not approved for publication**. This document prepares the missing disclosure without changing the approved public design or deploying the old `index.html` from this repository.

## Observed on 2 October 2026

- `https://siyadah-ai.com/` returned HTTP 200 from `server: Portail` at `91.234.194.249`. Its HTML SHA-256 was `8f3e842bb51b73e200cae104819cfd98e4984753ad2afdae08a7cd22fa256880` (57,174 bytes). No matching `index.html` was found in the checked t43 history and local worktrees. The page displays a waitlist and has no visible privacy link. **Do not replace it with t43's old `index.html` as a shortcut.** Find its LWS/cPanel source first.
- `https://siyadah-ai.com/privacy.html` returned HTTP 404. `https://accounts.siyadah-ai.com/privacy.html` returned HTTP 200, but its current content covers the waitlist, not how the product handles Google user data.
- The code path in this branch limits Siyadah-owned Google OAuth to the Gmail piece, sends an authorization code and client credentials to Activepieces to create a connection scoped to one company project, and provides a disconnect action: `lib/tool-connections.mjs`. The current pilot sends a configured message through Gmail; it is not evidence that general customer sending is available. The exact scopes are read from provider piece metadata at runtime, so verify the requested scope at consent before making a claim that only `gmail.send` is requested.
- Google [verification requirements](https://support.google.com/cloud/answer/13464321) require a public privacy page on the verified homepage domain, the **same privacy URL** on the homepage and consent screen, and disclosure of how Google data is accessed, used, stored, and shared. Google's [privacy policy guidance](https://support.google.com/cloud/answer/13806988) also requires an actual policy tied to this product, not a template.

## Proposed bilingual Gmail disclosure

Place the final, reviewed copy within the full policy on **one canonical URL**, preferably `https://siyadah-ai.com/privacy.html`, and link that exact URL from the public homepage, the signed-in app, and Google OAuth branding. Keep any `accounts.siyadah-ai.com/privacy.html` page pointing to the same complete policy or redirect it to the canonical URL after checking existing links.

### العربية

**ربط Gmail.** عندما تختار ربط حساب Gmail بسيادة، نطلب إذنك لإرسال رسائل بريد من حسابك لتنفيذ المهام التي تحددها داخل شركتك. تتلقى سيادة نتيجة تفويض Google، وتُنشئ اتصالًا خاصًا بمشروع شركتك لدى مزود تشغيل التدفقات Activepieces. عند تنفيذ مهمة إرسال، قد تُعالَج بيانات الرسالة اللازمة لها، مثل المستلمين والموضوع والمحتوى، بواسطة سيادة ومزود التشغيل وGoogle لإرسالها وإظهار حالة التنفيذ. لا يتطلب مسار الإرسال الحالي قراءة صندوق الوارد أو جهات الاتصال؛ أي صلاحيات إضافية تحتاج وصفًا وموافقة جديدين قبل استخدامها.

**التحكم والحدود.** يمكنك فصل اتصال Gmail من سيادة أو إلغاء إذنه من حساب Google. إلغاء الإذن يمنع الاستخدام اللاحق، لكنه لا يسترجع رسائل أُرسلت بالفعل. لا تُستخدم بيانات Google التي تصل عبر هذا الربط للإعلانات أو لتدريب نماذج ذكاء اصطناعي عامة. نستخدمها للميزة التي وافقت عليها، ولأغراض الأمان والدعم المرتبطة بها فقط، ونطبق متطلبات الاستخدام المحدود لبيانات Google. للاستفسار عن البيانات أو طلب حذفها، تواصل مع عنوان الخصوصية المنشور في السياسة.

### English

**Connecting Gmail.** When you choose to connect Gmail to Siyadah, we request your permission to send email from your account for tasks you specify within your company. Siyadah receives the Google authorization result and creates a connection assigned to your company's project with our workflow execution provider, Activepieces. When a sending task runs, message data needed for that task, such as recipients, subject, and body, may be processed by Siyadah, the execution provider, and Google to send the message and report its outcome. The current sending path does not require access to your inbox or contacts. Any additional access would require a new description and authorization before use.

**Your control and limits.** You can disconnect Gmail in Siyadah or revoke access in your Google account. Revocation stops future use; it cannot recall messages already sent. Google data received through this connection is not used for advertising or to train general-purpose AI models. We use it for the feature you authorize and related security and support only, in line with Google's Limited Use requirements. Use the privacy contact in the policy for data questions or deletion requests.

## Gates before publishing this copy

1. Confirm the actual data flow and retention for OAuth tokens, message contents, execution logs, backups, and deletion in Railway, Activepieces, and Google. Do not add a retention deadline or country of processing without proof.
2. Confirm the exact scopes shown in the live Google consent screen and enforce the intended Gmail scope in the backend. The current code takes the scope from provider metadata.
3. Confirm the privacy contact mailbox works and assign a response owner. Review claims about model training, third-party processing, legal rights, and cross-border transfer with the product/legal owner.
4. Identify and back up the **actual LWS public-site source**. Add an easily accessible privacy link to the existing English and Arabic pages without replacing the visual design. Publish the reviewed policy at the canonical URL. Fetch it anonymously and verify HTTP 200 and correct content.
5. Set the Google Branding privacy URL to that same canonical URL. Verify domain ownership in Search Console first; then complete branding and scope verification separately. A published privacy page is not Google approval.
