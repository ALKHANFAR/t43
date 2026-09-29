# Working notes — branch `base/v1.9.0`

Working branch chosen by the owner on 2026-09-29: tag `v1.9.0` (simulated chat, no backend). Every change lands here until the owner approves it; `main` (MCP wiring) is not touched.

## Map
| File | What lives there |
|---|---|
| `index.html` / `ar.html` | Public site EN / AR: hero + live console, how, 4 employees (`#dept`), pricing, reserve form (`#join`), FAQ. CSS inline in each file. |
| `site.js` | Shared by both site pages. `CONFIG` at the top (form endpoint, pricing numbers); strings picked by `<html lang>`. |
| `app/chat.html` | The app shell (Arabic, RTL). All CSS inline; tokens on `:root` (`--ink`, `--accent`, …). DOM ids used by `chat.js`: `emps`, `thread`, `input`, `send`, `modal`, `sheet`, `pane-plan`, `pban`, `pal`, `hq`. |
| `app/chat.js` | The whole simulator, one IIFE. Data at the top: `PRICING`, `PLAN`, `ACTIONS`, `EMPS` (4 employees), `TN`, `MEM`, `CHATS`, `SUGG`. Then: render (side, bar, messages, opener), employee intent router (`empReply`), `send`, event engine `playEvents`, scenarios (`buildEvents`, `proactiveEvents`), tools catalog, sheet/plan, keyboard, hash routes. |
| `app/onboard.html` / `.js` | Four-step onboarding (site → sentence → plan → go live), simulated. |
| `pieces.js` | Tool catalog `window.PIECES`: `[slug, name, descEN, category, logo, descAR]`, 712 tools. |
| `integrations.html/.js`, `demo*.html/.js`, `privacy.html`, `404.html` | Secondary pages. |
| `Dockerfile`, `nginx.conf`, `.dockerignore` | Static nginx container (added for hosting; `*.md`, `scripts/`, `package*.json` excluded). |

## The backend seam
`chat.js` line 1 documents the orchestrator event contract (`say / step / handoff / await / preview / result / done`). `playEvents(list, events)` plays them; wiring a real backend = feeding the same events from the server instead of the local arrays. Keep that seam; do not spread network calls through the UI.

## Live side effects — careful
- `site.js` `CONFIG.endpoint` posts the reserve form to a live Activepieces Cloud webhook. Do not submit the form while testing.
- Everything in `app/` is local simulation; no network calls.

## Rules for changes
- Smallest change that does the job; match the existing compact style (ES5, `var`, single-line helpers, Arabic comments).
- Numbers live in one place: `PRICING`/`PLAN` in `chat.js`, `CONFIG.pricing` in `site.js`.
- Bump `?v=` query strings in HTML when a JS file changes.
- Before pushing: `npm run lint:js && npm run catalog && npm run validate && npm run a11y` (GitHub Actions on this account does not start jobs, so run locally).
- Preview locally: `python3 -m http.server 8743` from the repo root.
