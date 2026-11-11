# Remove Datadog Entirely (PS-146)

## Summary

Owner direction 2026-11-10:  Datadog is useless on the free tier — remove it from the
portfolio completely.  Sentry (`personal-site` project) owns all observability:
browser errors, tracing, Session Replay, and logs.  Do not reintroduce Datadog or any `DD_*` env var.

## What was removed

- `site/src/lib/datadog/` (fail-closed, server.server dd-trace boot).
- Server boot import in `site/src/router.tsx`; dd-trace externals in
  `site/vite.config.ts`; `DD_*` fields in `site/src/vite-env.d.ts`.
- `scripts/verify-datadog.mjs` and its CI step in `ci.yml`; the verify command
  in `.github/pr-autofix-trusted.yml` and `claude-code-autofix.yml`.
- `dd-trace` dependency and lockfile entries.
- `DD_*` settings rows in `site/src/lib/settings.server.ts`, their unit-test
  assertions, Infisical SOT inventory entries and allowlist, and the
  commented block in `site/.env.example`.
- Docs:  AGENTS.md observability section, README.md, INFISICAL.md rows,
  STATUS.md entry, and this note.

## Kept

- The start site's Datadog card and admin monitors panel (`start/`) stay:  they
  read the operator's separate fleet Datadog account and are an ops surface,
  not portfolio instrumentation.  The start identity test that invoked the
  deleted verifier was dropped; the card-identity tests stay.

## Verification

- `npm run typecheck` clean; `npm run build` (Nitro vercel preset) green.
- `site` unit tests 17/17 pass via tsx; start-site suite 40/40 pass.
- `node scripts/verify-sentry.mjs` and `node scripts/verify-infisical-sot.mjs` pass.
- Repo grep outside archives (static/, docs/ history, start/) shows no
  remaining Datadog references in site code, scripts, CI, or env examples.

## Follow-up (same day)

Owner asked for the start site's Datadog too.  Removed: the start page card
and its `si-datadog` icon, the admin panel's Datadog Monitors entry and
`renderDatadog`, `checkDatadog` and its CHECKS entry in
`start/api/_admin/worker.mjs`, and the card identity test.  `DD_API_KEY` /
`DD_APP_KEY` env vars on the start Vercel project can be deleted by the owner.
