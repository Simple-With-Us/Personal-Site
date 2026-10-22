# Personal Site reads Infisical prod only (2026-10-10)

Owner directive (2026-10-10): the `dev` and `staging` environments of the Personal Site Infisical project (`44091453-1d4d-4369-b476-751a188c1ee4`) are being retired.  Every code and config path now selects `prod`.

## What changed

- `infisicalEnvironment()` in `site/src/lib/settings.server.ts` always returns `prod`.  Vercel Preview, local development and an unset `VERCEL_ENV` no longer map to `staging` and `dev`.
- The guard: an `INFISICAL_ENV` override with any non-prod value is refused.  It logs a warning and is ignored.  It never throws, because the function runs while the settings client boots and a throw would take the server down.
- The Infisical coordinates file under `.cursor/` selects `prod`, and `scripts/cursor-cloud-start.sh` defaults to `prod` and exits 1 on any other `INFISICAL_ENV` (an uncredentialed boot still exits 0, as before).
- `site/.env.example` and `INFISICAL.md` describe the prod-only contract.  The unit test for the mapping now asserts prod everywhere and the refusal.

## Production impact

None.  The Vercel project has no Infisical variables (names checked 2026-10-10), so the deployed site runs in degraded mode and never reads Infisical.

## Keys

Prod now holds the six non-empty keys moved from dev: `DD_SERVICE`, `DD_SITE`, `DD_TRACE_SAMPLE_RATE`, `GROK_AUTH_ISSUER`, `SENTRY_FLEET_DSN`, `VITE_AUTH_ENABLED`.  The eleven empty placeholders in dev (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `DD_AGENT_HOST`, `DD_API_KEY`, `DD_APPLICATION_ID`, `DD_CLIENT_TOKEN`, `DD_TRACE_AGENT_PORT`, `EMAIL_PASSWORD_ENABLED`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET`) were not copied.  Every reader treats an empty value as unset, so reading prod without them behaves exactly as reading dev did.
