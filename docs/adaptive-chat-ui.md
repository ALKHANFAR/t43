# Adaptive employee UI — implementation boundary

Source: founder-provided Siyadah-Intelligent-UI-Research-20261010 (1).docx, 10 October 2026.

The existing vanilla JavaScript chat is retained. React is an optional renderer choice in the research document, not a reason to replace the current application. `lib/chat-ui.mjs` derives a versioned presentation contract from existing server response metadata without any extra LLM calls or tools. `json` attaches it to scoped chat responses. The browser escapes values and accepts only matching employee cards and three known presentation operations. Unknown components or operations are ignored. It does not interpret model HTML or JavaScript.

Employee cards distinguish saved drafts, disabled workflows and active employees. A listed employee tool does not claim an ACTIVE connection. Edit, read-only review and test-plan controls populate the composer; they require the user to send the request through the existing authenticated chat. They never execute on render, locale change, reload or button click. Existing request identity, approvals, company isolation, tested-version publication and result-proof controls remain authoritative.

Plain answers remain text; existing scalar JSON/Markdown tables provide comparisons. Existing request states, approval controls, connection panels and run receipts remain available in both chats. Card state is not proof of business productivity. Existing employee pin and saved conversation text survive reopening; this change does not persist adaptive schema in historical messages.

Validation: 538 runtime cases, 537 passed, one PostgreSQL integration skipped, zero failed. Index: 28 features / 313 anchors. JS syntax, HTML validation and catalog checks passed. axe/jsdom reported zero violations across seven pages; browser-rendered contrast and live usability were not measured.

This is a foundation implementation, not the complete research vision. Remaining work: optional model-selected schema within the existing model response, schema-aware historical persistence, missing-field forms backed by actual server contracts, genuine incremental transport/rendering, and a comparison experiment measuring first useful result, clicks, task completion, execution errors and token usage. Streaming cannot be replaced with a cosmetic typing animation. Optional expanded journeys must follow customer intent, not be compulsory. No migration to React, automatic external action, deployment or live provider acceptance occurred.

Release requires fresh end-to-end main/employee chat acceptance on the candidate SHA, real provider evidence for any claimed result, PostgreSQL isolation/recovery checks, and explicit production authorization. Reverting this presentation change requires no database rollback.


## Adaptive contract extension — 10 October 2026

The optional model-selected plan/form/table/suggestion contract now shares one parser between server and browser. Historical message text can replay the validated presentation; local field values/details/dismissal survive redraw without crossing conversations, controls relocalize, and repeated prepare clicks do not duplicate the unsent input. No model-defined executable actions or results are accepted. See adaptive-experience-contract.md and adaptive-experience-audit.md for the exact scope, usage/pricing measurement and remaining live acceptance. Streaming, 100-journey comparison and live sales-employee outcome remain unproved.
