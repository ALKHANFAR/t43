# Native MCP published Flow proof — isolated QA, 8 October 2026

This proves live native MCP discovery and a real provider read from a published Flow in an isolated Activepieces QA service. It does not prove a Siyadah customer employee chat, customer OAuth consent, persistent customer connection, or general production readiness.

## Deployed image and project

- Railway service: `activepieces-auth-schema-qa`, `588b6f0b-3754-4b13-a513-05af4ea1554a`.
- Exact deployment: `9173158b-9281-44d6-a15e-c7463a891f45`, terminal `SUCCESS`; uploaded local Activepieces PR #4 source `9f7e0af` on image 0.92.1.
- Uses its own embedded PGLITE database and MEMORY Redis, fresh random encryption/JWT keys, one worker, and no production database/provider credentials.
- New QA project: `4msYLTmprIPfuRTmJMvhz`. MCP token issued through the native authenticated project endpoint; token values are excluded.
- `ap_setup_guide` returned `schemaVersion:1`, Asana version `0.7.0`, `OAUTH2`, authorization URL and `default` scope.
- The actual Siyadah PR #64 `createToolConnectionService.methods` consumed this live MCP response and, with its existing cloud OAuth configuration enabled, returned `available:true` with a fingerprint. This is a direct adapter probe, not the public customer route or consent completion.

## Build, publish and execute

Flow `qqFeRj6zI7ZriM2aB03Mi` was built using native `ap_build_flow`, after native research and property reads. No REST build/edit/publish request and no CODE step were used. It has three native steps: MCP Tool trigger with Wait for Response, HTTP GET to Open-Meteo for Riyadh weather, and Reply to MCP Client. It sends no messages and changes no provider/customer records.

- Configuration test: `jHKK9nNEPrSHY9feQMixc`, `TESTING`, `SUCCEEDED`.
- Native `ap_lock_and_publish` returned success; independent API readback confirmed `ENABLED`, version `6tJ9Ix5kiR7ka9EYU9TtB`, `LOCKED`.
- The published name was discovered from native `tools/list`: `qa_delivery_weather_riyadh_qqfe_rly4t9_mcp`. An earlier unsuffixed name was rejected as not found and started no run.
- Production execution: `MRNXti6hGYjrHcJG1j5RI`. Native MCP returned the provider payload plus exact run/project/Flow/version identity and `environment:PRODUCTION`.
- Native `ap_get_run` and independent `GET /api/v1/flow-runs/:id?projectId=...&includeSteps=true` confirmed the same run, project, Flow, published version, terminal `SUCCEEDED`, and successful HTTP/response steps.
- Provider HTTP status: 200. Provider timestamp: `2026-10-08T00:45` Asia/Riyadh. Returned temperature: 32 °C, precipitation: 0 mm, wind speed: 9 km/h. These are the recorded provider values, not a current weather forecast or merchant KPI.

The redacted readback is saved in `ABO-69-native-production-qa-20261008.run.json`. Production Siyadah and Activepieces services remain at their previous releases; both PRs remain draft. Next gate: exercise the paired app through a new customer's employee chat, actual provider consent/connection when required, exact production run proof and customer-visible result. The temporary QA service remains available; its prior cleanup attempt was rejected by automatic approval review.
