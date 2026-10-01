# Gmail connection under Siyadah

The integrated draft branch prepares one customer connection path for Gmail. It is not a live connected tool.

- Serve this application on a verified `*.siyadah-ai.com` origin. `SIYADAH_PUBLIC_URL` determines the exact callback: `/siyadah-api/v1/integrations/oauth/callback`. The Google web client must register that exact HTTPS URI.
- Configure `SIYADAH_GOOGLE_OAUTH_CLIENT_ID` and `SIYADAH_GOOGLE_OAUTH_CLIENT_SECRET` only as server secrets. No Google client currently exists after the three old clients were deleted. Without both values or a Siyadah callback origin, Gmail OAuth remains unavailable in the customer UI.
- Run the additive database pre-deploy migration before serving the new image. The callback requires `siyadah_google_oauth_attempts`; `/health` fails closed if the table is missing.
- OAuth state is encrypted, expires in ten minutes, and is consumed once for the initiating company and browser session. The provider connection must read back as `PROJECT` with exactly one project, matching the company mapping. Other OAuth providers remain unavailable.
- Local tests use a simulated provider. Before release, verify Google consent, callback, saved project-exclusive connection, an actual Gmail action, provider result, customer-visible result, and isolation between two companies. Do not describe consent or a saved connection as an executed task.

The older experimental Google OAuth branch includes a cloud fallback and a weaker project check. Do not merge it into the canonical branch wholesale.
