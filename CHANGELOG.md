# Changelog
All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

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
