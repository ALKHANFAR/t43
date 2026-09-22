# Siyadah core — isolated start

This folder is a new decision layer for the user-facing UI in `/app` and Activepieces.
It does not import the existing Siyadah orchestrator. Nothing in this branch changes
production, `main`, UI behavior, or an Activepieces flow.

## First implemented unit

`selectPlan` takes an outcome contract, the authenticated tenant's allowed actions and
connections, action-level capability metadata, and candidate recipes. It rejects
unauthorized, disconnected, schema-incompatible, or outcome-unobservable paths.
It does not assign invented tool quality scores or call an LLM/AP endpoint.

Run `cd core && npm test` (Node 22+).

## Boundary to implement next

1. Server-verified identity and tenant/employee permissions; never trust tenant IDs sent by the browser.
2. Discover actions and input/output schemas from the actual Activepieces account, then inspect specific candidates.
3. Build a goal contract: objective, available evidence, constraints, approval, and source of truth.
4. Build and verify flows via documented AP endpoints after real API and plan capability checks.
5. Persist request idempotency, approvals, AP run receipts, and independently observed business outcomes.
6. Adapt the current `app/chat.js` message/work/hydrate interface after the new server is proven.

No real customer data, AP credentials, automatic execution, or economic uplift is asserted here.
