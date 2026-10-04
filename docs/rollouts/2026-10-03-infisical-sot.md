# 2026-10-03 — Infisical sole source of truth for app settings

Fleet directive: Infisical is the single source of truth for secrets, env
vars, and tunable settings knobs.  This rollout migrates Personal-Site's
server settings to a startup-loaded, memory-cached Infisical client with
background refresh, an owner-only admin console, and write-through saves.
Branch `infisical-sot`.

## What changed

- New `site/src/lib/settings.server.ts`: singleton settings service built on
  the shared `createInfisicalSettings` (`@jaywedgeworth22/congress-trading-shared`,
  `github:Simple-With-Us/congress-trading-shared#semver:^2.7.1`).  19-key
  inventory, VERCEL_ENV → dev/staging/prod environment mapping
  (`INFISICAL_ENV` override), top-level-await init, SIGHUP refresh hook,
  degraded mode (no bootstrap creds → `process.env` fallbacks, admin
  write-through disabled), fail-fast boot when creds are present but the
  load fails.
- New `site/src/lib/settings-admin.ts`: `createServerFn` RPCs —
  `getSettingsInventory` (names/metadata only, never values),
  `updateSetting` (Infisical FIRST, then cache), `reloadSettings` — all
  behind `authMiddleware` (401 for signed-out; the signed-in owner IS the
  admin, no role system on this single-owner site).
- New `/admin/settings` route: owner-only console (SignedIn/SignedOut
  gates), blind value entry, values never displayed.
- Rewired to the cache: `db.ts` (`DATABASE_URL`), `auth/server.ts`
  (`GROK_AUTH_*`, `BETTER_AUTH_*`, new `EMAIL_PASSWORD_ENABLED` knob),
  `auth/verify.server.ts` (`databaseConfigured`), `datadog/server.server.ts`
  (memory-only reads; still publishes resolved `DD_*` to `process.env`
  because dd-trace reads them at import).
- `INFISICAL.md` (repo root): policy, key inventory, per-user boundary,
  cache/refresh/write-through contract, rotation notes.
- `site/.env.example`: bootstrap + migrated keys, no real values.
- `scripts/verify-infisical-sot.mjs`: CI lint (INFISICAL.md key coverage,
  project ID, no secret-shaped values, no direct `process.env` reads for
  migrated keys outside the allowlist).  Wired into `ci.yml` verify job;
  `npm run test:unit` wired into `site-ci.yml`.
- `site/tests/unit/settings.test.ts`: 16 tests (init, zero post-init
  network, write-through ordering, refresh/write failure semantics,
  inventory DTO, degraded mode).
- Visual: `admin settings (signed out)` spec + committed baseline.
- Infisical project `Personal Site` (`44091453-1d4d-4369-b476-751a188c1ee4`)
  dev environment seeded with non-sensitive defaults; secret-shaped keys
  created as empty placeholders for the owner to fill.

## Deliberately left out

- Per-user settings stay in the app DB / Better Auth (never Infisical).
- Platform vars (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`).
- Build-time client bundle config (`VITE_*`, RUM keys in `vite.config.ts`) —
  source is the Infisical→Vercel env sync; redeploy after rotation.
- `scripts/migrate.mjs` build-time DB migration (reads `DATABASE_URL` at
  build time; skips when unset).
- Hardcoded `PREVIEW_CLIENT_SECRET` fallback in `preview.ts` (public
  low-privilege preview client; rotate broker env + constant together).

## Verification

- `npm run typecheck`: clean.  `npm run lint`: 0 errors (2 pre-existing
  warnings in untouched files).  `npm run build`: passes (incl.
  `db:migrate` skip when `DATABASE_URL` unset).
- `npm run test:unit`: 16/16 pass.
- `node scripts/verify-infisical-sot.mjs` and `node
  scripts/verify-datadog.mjs`: pass.
- Fixed along the way: repo's `package-lock.json` had been regenerated
  (better-auth 1.6.25 → 1.7.7, breaking the pre-existing
  `genericOAuthClient` import); restored the original lock and added the new
  dependency minimally — typecheck is now fully clean.
- Note: `/api/auth/*` has no server route in this repo, so the dev
  signed-out state resolves via 404 → signed out.  The admin console's
  signed-out card (not a `/login` redirect — that route was never created)
  is what ships.

## Follow-ups

- Owner: fill the empty placeholder secrets in the Infisical `Personal
  Site` project (dev/staging/prod): `DATABASE_URL`, `GROK_AUTH_CLIENT_ID`,
  `GROK_AUTH_CLIENT_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
  `DD_API_KEY`, `DD_APPLICATION_ID`, `DD_CLIENT_TOKEN`, `DD_AGENT_HOST`,
  `DD_TRACE_AGENT_PORT`, `EMAIL_PASSWORD_ENABLED`.
- Confirm the Infisical→Vercel env sync covers the project so deploys get
  the values; set `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` on the
  Vercel project (the only env vars that live outside Infisical).
