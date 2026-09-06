# Security Policy

## Reporting a vulnerability
Email **security@siyadah-ai.com** (also published at `/.well-known/security.txt`, RFC 9116).
We acknowledge within 48 hours and aim to fix confirmed issues within 14 days.
Please do not open public issues for security reports.

## Scope
- siyadah-ai.com and every page in this repository
- The waitlist submission path (browser → Activepieces webhook)

## What we already do
- Static site, no server-side code, no secrets in this repository
- No inline scripts or handlers, no third-party requests while browsing (fonts self-hosted), no secrets in the repo
- Security headers (strict CSP with `script-src 'self'`, HSTS preload, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP) are defined in `.htaccess` and apply on Apache hosting only; GitHub Pages does not send them
- Honeypot + client validation on the form; server-side validation in the automation flow
- No third-party trackers or analytics cookies (PDPL / GDPR)
