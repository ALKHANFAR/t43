# Siyadah Developer Lab

Local-only prompt and agent-behavior comparison. It does not import the production server, database, tenant sessions, or Activepieces.

1. Put a development-only `DEEPSEEK_API_KEY` in the local shell.
2. Edit `context.json` with sanitized test data.
3. Run `npm run lab` and open `http://127.0.0.1:8766`.
4. Compare the three variants and export the winner as a change-request JSON.

The server binds to localhost and refuses to start when Railway or `NODE_ENV=production` is detected. Choosing a winner never changes production.
