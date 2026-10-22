# 2026-10-11 — Replace Datadog RUM with Sentry browser SDK

## Summary

Browser observability moves from Datadog RUM to the existing Sentry project
`personal-site`.  `@sentry/react` ships errors, tracing, Session Replay, and
browser logs.  Release is `VERCEL_GIT_COMMIT_SHA`.  `@sentry/vite-plugin`
uploads hidden source maps when `SENTRY_AUTH_TOKEN` is set.  Server Datadog
(`dd-trace` + HTTP logs) stays.

The daily Mirror live site workflow no longer pushes `main` (branch
protection rejected that and reded FLEET-INFRA-DT/DV).  It opens or updates
`mirror/live-site` as a pull request.

Branch `cursor/sentry-rum-replace-d859`.  TypeScript 7 PR #145 is left
alone.

## Files

- `site/src/lib/sentry/*` — browser init, public env, invisible mount
- `site/src/routes/__root.tsx`, `site/src/lib/error-component.tsx`
- `site/vite.config.ts` — `SENTRY_*` defines + vite plugin
- `site/vercel.json` — CSP ingest + replay worker
- `site/package.json` — `@sentry/react`, `@sentry/vite-plugin`; drop
  `@datadog/browser-rum` and `@datadog/browser-logs`
- `scripts/verify-sentry.mjs` + CI `verify` step
- `scripts/verify-datadog.mjs` — server-only; asserts RUM files are gone
- `.github/workflows/mirror-site.yml` — PR instead of push to main
- `INFISICAL.md`, `AGENTS.md`, `README.md`, `STATUS.md`

## Secrets Jay must set

See the PR body.  Names only: `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` on Vercel
`personal-site` and in Infisical project Personal Site (`prod`).  Optional
overrides: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ENVIRONMENT`,
`SENTRY_RELEASE`.

## Verification

```bash
test -f static/index.html
test -f AGENTS.md
test -f docs/EFFORT-LOG.md
rg -n "Earlier work included" static/index.html
node scripts/verify-datadog.mjs
node scripts/verify-sentry.mjs
node scripts/verify-infisical-sot.mjs
cd site && npm run typecheck && npm run lint && npm run test:unit
```
