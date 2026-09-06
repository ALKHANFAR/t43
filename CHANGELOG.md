# Changelog
All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

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
