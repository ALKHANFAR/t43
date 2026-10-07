# Acting employee chat — live isolated QA, 8 October 2026

The actual Siyadah server at commit `ea70788` accepted a customer's employee-chat request, called the configured real `deepseek-chat` provider, executed the employee's published Flow through native MCP, verified the exact production run, and returned the provider data plus run reference. No scripted model or fake MCP response was used. Product source was unchanged during this proof.

## Scope and preparation

Siyadah ran locally on port 4319 with its own PostgreSQL UTF8 database; Activepieces ran in isolated Railway QA deployment `9173158b-9281-44d6-a15e-c7463a891f45`. Neither used the customer-serving production database. A local fixture created and verified the QA account through the actual auth service, mapped its existing QA project, and adopted the existing published Flow. Native OAuth registration/approval/code exchange stored the project MCP grant. This fixture setup does not prove customer signup email delivery, automatic provisioning or browser self-service consent. Provider Open-Meteo needs no user connection. Existing model credentials were used without printing them.

- Company: `company_Sd49AgSaQfc5kkHddmNou9SP`.
- Employee: `98145e25-9016-44e4-8320-80c61e2df6b4`.
- Project: `4msYLTmprIPfuRTmJMvhz`.
- Flow: `qqFeRj6zI7ZriM2aB03Mi`; published version `6tJ9Ix5kiR7ka9EYU9TtB`.
- Real customer login endpoint returned 200; employee activation endpoint tested the Flow and returned `state_verified:true`, `status:active`.

## Request and result

`POST /siyadah-api/v1/chat`, `op:message`, employee above, conversation `qa_delivery_employee_20261008`, request `qa_delivery_employee_utf8_live_20261008`:

> تحقق الآن من طقس الرياض لتخطيط توصيل طلبات المتجر، نفّذ طريقة عملك المنشورة وأعطني الحرارة والمطر وسرعة الرياح ووقت بيانات المصدر. لا تبني ولا تعدّل أي فلو.

The actual server's real model path selected the published Flow tool. Returned customer response: `request_status:succeeded`, `work_status:succeeded`, `outcome_kind:tool_result`, `run_id:Z0PKrmvHrcpJS9nuqghUS`. Independent Activepieces API readback confirmed `PRODUCTION`, terminal `SUCCEEDED`, exact project/Flow/published version, and provider HTTP 200. Recorded Open-Meteo data at `2026-10-08T00:45` Asia/Riyadh: 32 °C, 0 mm precipitation, 9 km/h wind. It is a provider read, not a merchant KPI.

## Persistence, replay, isolation and display

- The actual request ledger persisted the same execution identity and result; employee last-run metadata referenced `Z0PKrmvHrcpJS9nuqghUS`.
- `op:work`, hydration and replaying the identical message/request returned the same run. An independent FlowRun inventory still contained exactly two production runs: the prior direct MCP probe and this employee request; no replay run was added.
- A second company logged in through the actual API. Its attempt to activate this employee returned 404 `employee_not_found`; reading the first company's request returned `not_observed/unverified` without a run or employee object. This is two live negative scope checks, not exhaustive authorization coverage.
- Actual `app/chat.js` rendered the recorded customer response, provider values and exact run reference in JSDOM; the text included the verified-run label. This is a DOM readback, not a browser screenshot or a public production UI visit.
- A first local database used SQL_ASCII and caused Arabic title inserts to fail before model/Flow dispatch. Replacing it with UTF8 resolved the fixture issue without changing product code. Failed request IDs were not reused.

Redacted artifacts in `ABO-69-employee-chat-live-qa-20261008.receipts.json` include customer response, exact run, durable identity, replay, and foreign-company readbacks. Secrets, session cookies, passwords and OAuth URLs/tokens are excluded. PR #64 and Activepieces PR #4 remain draft; customer-serving releases remain unchanged. Remaining production gates include real new-customer provisioning/consent, a customer-owned authenticated provider connection/result, reviewed paired release and broader recovery/authorization coverage.
