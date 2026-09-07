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
- No inline scripts or handlers; fonts and logo self-hosted; the only third-party requests while browsing are integration logos from cdn.activepieces.com, fetched without cookies or referrer
- Security headers (strict CSP with `script-src 'self'`, HSTS preload, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP) are defined in `.htaccess` and apply on Apache hosting only; GitHub Pages does not send them
- Honeypot + client validation on the form; server-side validation in the automation flow
- No third-party trackers or analytics cookies (PDPL / GDPR)
