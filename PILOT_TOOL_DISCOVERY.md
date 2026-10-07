# ABO-40: retired REST inventory

The legacy REST inventory is closed. `pilot_discover` is not a customer integration operation. The unused compatibility library and its two self-contained tests were removed on the isolated consolidation branch on 7 October 2026. Repository reference search found no production import or caller. Current connection preparation still rejects unavailable native schemas; removing this stub does not enable REST discovery.

Native company-scoped MCP provides discovery and operation fields. See [the boundary](docs/mcp-tool-discovery-boundary.md). No inventory response proves a provider outcome.

Deletion risk: 1/10 (engineering estimate based on repository references, not proof about consumers outside this repository). Production, Activepieces, and other branches were not modified.
