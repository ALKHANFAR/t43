# Changelog
All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [1.8.1] — 2026-09-07
### Changed
- Kept the disciplined monochrome + single green accent (no new colours); depth now comes from execution, not decoration
- Tool logos sit in clean white rounded tiles with a faint shadow across the catalog, employee cards and the connect dialog; cards lift slightly on hover
- The built-in "site chat" tool shows a chat-bubble icon instead of the green leaf placeholder

## [1.8.0] — 2026-09-07
### Added
- Employee profile card: identity, tenure, on/off, four role-specific KPIs with week-over-week trend, the employee's tools with logos and connect state, working hours, instructions expander
- Employee replies with a persona voice and an intent router: status, why (cites the log and your rule), adjust (diff card + save updates the instructions and version), needs (lists unconnected tools), pause/resume, and a clarifying fallback; typing indicator and progressive reveal (skipped under reduced motion)
- Decision buttons resolve the card, post the decision, decrement the badge and add a log line; "why?" and "copy" actions work; ⌘K command palette (new chat, employees, tools, settings, plan, history matches); hash deep links for demos (#e=saad, #say=…, #plan=trial)
- Site: action defined and numbered (3,000 / month), prepaid credit pack (100 SAR = 500 actions) rendered from CONFIG.pricing, annual total shown (4,990 SAR), plan CTA "Start at the early price"
### Changed
- Plan & usage: one PRICING source, Arabic plan name, prepaid balance line, single "Manage subscription" button, coherent trial / over / past-due states, masked tax and CR numbers
### Fixed
- FAQ said "billed monthly" next to an annual toggle; duplicate "Invoice billing" line; console status still said "departments"; history titles cut mid-word; Qoyod listed as "coming soon" while Noura uses it

## [1.7.0] — 2026-09-07
### Changed
- Site simplified to six sections: hero, how it works, four AI employees (one line each), pricing, reserve, four questions. Removed the stats strip, the "cost of doing it yourself" section, the department tabs, the perks cards, the seat meter and countdown, the sticky bar, and the role/country selects (form is now name, WhatsApp, email, optional company)
- New pricing section (EN/AR) in the ChatGPT pattern: Business plan (499 SAR early / 998 list, 50% for life), Enterprise on request, monthly/annual toggle (2 months free), one usage line (chat unlimited, executed actions metered, prepaid credits, no surprise bills), VAT/ZATCA/Mada footnote. Numbers live in `CONFIG.pricing` in site.js; a Starter plan renders only when configured
- App: employee page is a chat with the employee (pinned compact card, composer, today's log as messages); plan card appears inline in the reply; history search with ⌘K, ⌘⇧O new chat, shortcuts list; settings reduced to 5 rows; account menu to 3 items; tools view without category chips and a one-button connect dialog; 7-day chart, KPI tiles, segmented controls and version buttons removed
- New "Plan & usage" pane driven by a PLAN object (trial / active / near limit / over limit / past due states, usage bar, invoices, payment, VAT/CR)
- Onboarding collapsed to four moments: your site, your sentence, the plan, go live; tools connect just-in-time from the chat
### Fixed
- Arabic tool descriptions no longer flip to LTR when they start with a Latin word; duplicate descriptions differentiated; demo poster hints spaced; country lists identical in EN/AR

## [1.6.0] — 2026-09-07
### Added
- English demo film (`demo-en.html` + `demo-en.js`): same scenes, timings and audio as the Arabic film, LTR with Jost/Inter; the English hero links to it
- Arabic description for all 712 catalog tools (`pieces.js` sixth field); the integrations page and the app's tools panel show Arabic descriptions in Arabic mode and search both languages; the catalog check verifies the Arabic text
### Fixed
- Wordmark: the stray "I" before the H removed (reads SIYADAH AI); aspect ratio updated everywhere

## [1.5.1] — 2026-09-07
### Fixed
- Chat: tool dialog focus return after re-renders (listener bound once); settings sheet returns focus to the account button; dead "team" link replaced by a "soon" label; chip no longer hires a role that already exists
- Mobile nav sheet is not tabbable while closed; language switch sized like the other links
- Catalog: 712 tools after removing crypto/EV/entertainment pieces and a duplicate; truncated names fixed; 21 more recategorized; `pieces.js` cache-busted with a version query
- Copy: no orphan "·" in footers; 404 Arabic in RTL paragraphs; "first AI employees" (not departments); "Nobody on payroll" everywhere; curly quotes; static "/7"; Arabic privacy effective date; demo button labelled (Arabic); demo recording hint removed
- Integrations: footer © in LTR, "يُحدَّث تلقائيًا", grid rows no longer stretch on small result sets; browser language detection fixed
- Mail fallback uses the brand domain; docs corrected (h1 note, CLS note, removed non-existent app README reference)

## [1.5.0] — 2026-09-07
### Changed
- Catalog matched against the official Activepieces pieces list: 10 customer-connectable tools added (SMTP, FTP/SFTP, Form.io, Loops, Clay, Blackbaud, Bloomerang, Salsa, AnyHook GraphQL/WebSocket), 6 non-business no-auth pieces removed (crypto prices, chess, Hacker News, ...); 721 tools, all with logo, description and category; 126 tools moved out of "Other" into the right category (WhatsApp → Communication, QuickBooks → Accounting, ...)
- Integrations page: 54 featured tools for the Saudi SMB market shown first; "AI models" renamed "AI tools"
- Shared mini header (wordmark + home/language) on privacy and 404; wordmark link on the demo

## [1.4.0] — 2026-09-07
### Added
- Mobile navigation on the marketing pages: hamburger button opening a sheet with all links and the language switch (keyboard, Escape, aria-expanded)
- Settings sheet in the app now manages focus like the tool dialog (focus in, Tab trap, Escape, focus return); mobile drawer has a real scrim button, aria-expanded, Escape and focus handling
### Changed
- Hero lede (EN/AR) now says what the product is: AI employees working inside your tools, run from one chat; section 03 heading no longer contradicts the console ("Four AI employees. Nobody on payroll.")
- Arabic: passive-voice headings and bullets rewritten in dialect, em-dashes in prose removed, demo employee grammar matches gender, one shared brief sentence across site/demo/app
- One tagline everywhere ("works inside your tools"); integrations lede "No employee touches a tool you haven't connected"; 404 fully bilingual; twenty-riyal (not dollar)
- Type: same 4-step small-size scale in the app, demo and integrations; weight 300 everywhere (no 200 left)
- Demo uses a native <main>; settings tab no longer carries aria-selected; duplicate CSS removed; og:locale ar_SA/en_US with alternates; sitemap lastmod
- Wordmark preload now matches the CORS request of mask-image (was fetched twice)
- STANDARDS.md and SECURITY.md state the one third-party request while browsing (integration logos from Activepieces CDN, no cookies, no referrer)

## [1.3.0] — 2026-09-06
### Changed
- One `site.js` for both languages (strings picked by `<html lang>`); `index.js` and `ar.js` removed
- Logo and icon moved from inline base64 to `assets/wordmark.png` and `assets/icon.png` (preloaded, cached across pages); HTML payload roughly halved on every page
- Arabic metric label reads "4 موظفين"
- Integration logos requested without cookies (`crossorigin=anonymous`, no referrer); catalog grid reserves height (CLS 0)
- Demo stage has an intrinsic size before JS scales it (CLS 0); demo page has a main landmark
- Lighthouse (mobile): performance 95–100 on every page, accessibility / best practices 100, SEO 100 on indexable pages

## [1.2.0] — 2026-09-06
### Changed
- Typography: 6-step type scale instead of 35 ad-hoc sizes; display weight 300 (was 200); micro-label tracking capped at .08em; Arabic display line-height 1.3
- Copy (EN/AR): the repeated "not X, but Y" construction reduced to one instance; em-dashes in prose halved; one tagline, one CTA ("Reserve your seat" / «احجز مقعدك»), one stage name ("Private beta" / «البيتا الخاصة»)
- Arabic: grammar and register fixes (14 ساعة، أبي أحد، active voice in the sales card), Western digits everywhere, chip typos fixed
- Security and privacy claims made accurate: no "end-to-end" or "SOC 2" wording; privacy policy states cross-border processing (Activepieces Cloud, Google) under PDPL; Arabic policy in formal register
- Terminology: the product unit is "AI employee" / «موظف» in marketing copy
- Seat meter, countdown and queue position are now driven by the backend (`CONFIG.seatsClaimed`, `CONFIG.deadline`) and hidden until real values exist; no illustrative numbers are shown
- Chat prototype: canned reply no longer says "this is a design mockup"

## [1.1.0] — 2026-09-06
### Added
- Lighthouse accessibility audit in real Chrome (`npm run a11y:chrome`), run in CI alongside axe; contrast is now actually measured
- Catalog integrity check (`npm run catalog`): every tool must have a real description and a same-origin or Activepieces-CDN logo
- Self-hosted, subsetted fonts in `fonts/` (variable Jost/Inter/Readex Pro, one file per family and subset; no requests to Google Fonts; no visitor IP leaves the site while browsing)
- `.nvmrc`, tracked `package-lock.json`, `npm ci` + cache + least-privilege permissions in CI
- Focus management for the tool-connect dialog (focus in, Tab trap, Escape, focus return)
- `noindex` on app pages; description + canonical on demo and privacy pages
### Changed
- Integrations catalog: every one of the 717 tools now has a logo and a one-line description (175 restored from upstream, 152 written; no placeholder text)
- Secondary text, placeholders and input borders re-tuned to pass WCAG AA contrast on every page
- Mobile app layout: sidebar is an overlay drawer that closes on selection; "awaiting your decision" cards stack on small screens
- Demo stage centered on desktop (was clipped on the right); hero columns aligned to the top (no 300px gap under the headline)
- EN hero headline now uses the display scale (was rendering at browser default size)
- STANDARDS.md rewritten with tool-produced numbers and explicit tool limits (headers are Apache-only)
- Demo: employee roles consistent across scenes; demo length shown as 2:00 everywhere
- SEO: removed duplicate canonical/hreflang tags; shorter meta description
### Removed
- Duplicate `app/demo.html`, `app/demo.js`, `app/pieces.js`; duplicate privacy links in footers; stale PHP paths in robots.txt

## [1.0.0] — 2026-09-06
### Added
- Public site (EN/AR), integrations catalog (717 tools), 2-minute demo film, privacy policy, 404
- Product prototype: first-run onboarding, chat app with employees, tools, settings
- Standards: WCAG 2.1 AA (0 violations), valid HTML, strict CSP, SEO files, PDPL/GDPR privacy
- CI: HTML validation + accessibility audit on every push
### Changed
- Brand accent from ultramarine to signal green (#0B844B / #40E799)
- All scripts moved to external files (CSP without `unsafe-inline` for scripts)
### Removed
- Server-side PHP path (replaced by Activepieces webhook); all diagnostic tools
