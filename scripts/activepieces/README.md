# Activepieces 455 catalog integration

Versioned source for the preview gateway and generic catalog selector. `scripts/` is excluded from the frontend Docker image. No credentials are stored here.

- Keep the 10 existing Catalog v3 fields. The migration adds `operations_v1`, `contract_version`, `contract_status`, `contract_checked_at`, `contract_hash`.
- Source contracts come from installed piece metadata. `metadata_verified` is not a provider or business-outcome claim.
- The selector combines native action/trigger search with Arabic editorial metadata and operation retrieval. Fetch native property details before planning.
- Verify company/goal evidence, exact operations, output references and connection-only bindings before building disabled drafts.
- `employee-design/gateway.js` is the self-contained code-step bundle for preview flow `vtIB0yqpB3lMK3ykTSTgN`; preserve the existing input mappings when applying. It does not change the production factory or frontend by itself.

Run `node scripts/activepieces/employee-design/test.mjs`. The broader 764-piece snapshot and 60 legacy compatibility checks are recorded in the workspace evidence package, not embedded in the product.
