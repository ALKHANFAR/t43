# Changelog
All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

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
