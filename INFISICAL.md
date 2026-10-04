# INFISICAL.md — Personal-Site: Infisical is the sole source of truth

Owner directive (2026-10-03): Infisical is the sole source of truth for this
app.  "Truth" means secrets AND env variables AND tunable settings knobs —
everything the app's behavior depends on that is not code.  Per-user settings
stay in the app's own store and never go in Infisical.

- Infisical project: **Personal Site** (`44091453-1d4d-4369-b476-751a188c1ee4`), jays-services org.
- Environments: `dev` (local / preview), `staging` (Vercel Preview), `prod` (Vercel Production).  The app maps `VERCEL_ENV=production` → `prod`, `preview` → `staging`, anything else → `dev` (`INFISICAL_ENV` overrides; see `site/src/lib/settings.server.ts`).
- Bootstrap: the server needs `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` (universal-auth machine identity) in its own environment.  These two are the ONLY env vars that live outside Infisical by design — they are the identity that reads everything else.  Set them in Vercel (all environments) and in local `.env` (see `site/.env.example`).

## Key inventory

| Key | Kind | Status |
|-----|------|--------|
| `DATABASE_URL` | secret | Empty in Infisical — **to be filled by admin**.  Neon Postgres connection string.  Empty/absent = embedded PGLite fallback. |
| `GROK_AUTH_ISSUER` | env-config | Seeded (`https://auth.grok.me`). |
| `GROK_AUTH_CLIENT_ID` | secret | Empty — **to be filled by admin** (deployer-injected per-app client).  Falls back to the shared live-preview client. |
| `GROK_AUTH_CLIENT_SECRET` | secret | Empty — **to be filled by admin**.  Falls back to the shared live-preview client. |
| `BETTER_AUTH_URL` | env-config | Empty — **to be filled by admin** when deploying with a fixed origin.  Absent = dynamic base URL (preview allowlist). |
| `BETTER_AUTH_SECRET` | secret | Empty — **to be filled by admin**.  Falls back to a process-stable random secret. |
| `VITE_AUTH_ENABLED` | env-config | Seeded (`true`).  `"false"` forces auth off everywhere (shared dev user). |
| `EMAIL_PASSWORD_ENABLED` | knob | Empty (= default off) — **to be filled by admin** to enable local email/password sign-in without a code deploy. |
| `DD_API_KEY` | secret | Empty — **to be filled by admin** (agentless server logs + APM). |
| `DD_SITE` | env-config | Seeded (`us5.datadoghq.com`). |
| `DD_APPLICATION_ID` | env-config | Empty — **to be filled by admin**.  Also baked into the client bundle at build time (see below). |
| `DD_CLIENT_TOKEN` | secret | Empty — **to be filled by admin**.  Also baked into the client bundle at build time (see below). |
| `DD_SERVICE` | env-config | Seeded (`personal-site`). |
| `DD_ENV` | env-config | Empty — derived from `VERCEL_ENV` / `NODE_ENV` when unset. |
| `DD_VERSION` | env-config | Empty — derived from `VERCEL_GIT_COMMIT_SHA` when unset. |
| `DD_AGENT_HOST` | env-config | Empty — **to be filled by admin** on Coolify/Hetzner.  Unset = agentless intake. |
| `DD_TRACE_AGENT_PORT` | knob | Empty (= default `8126`). |
| `DD_TRACE_SAMPLE_RATE` | knob | Seeded (`0.2` — fleet cost rule for production traces). |
| `DD_FAIL_CLOSED` | knob | Empty (= default off).  `"1"` = Datadog required even outside production. |

Non-sensitive defaults were seeded into the **dev** environment; staging/prod
are filled by the admin at deploy time.  Secret values are NEVER invented,
guessed, or copied from elsewhere — empty means "admin fills this".

## What is deliberately NOT in Infisical (and why)

- **Per-user settings** (auth sessions, user rows, any per-user preference): live in the app's own store (Neon/PGLite via Better Auth + app tables).  Explicitly out of scope.
- **Platform-injected vars** (`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_GIT_COMMIT_SHA`): provided by Vercel at runtime; read directly where needed.
- **Build-time client-bundle config** (`VITE_*`, `DD_APPLICATION_ID`, `DD_CLIENT_TOKEN`, `DD_SITE`, … via `vite.config.ts` → `import.meta.env`): these are baked into the browser bundle at build time and cannot be fetched from Infisical at runtime (the browser must never hold the universal-auth client secret).  Their SOURCE is still Infisical — the deploy pipeline must sync Infisical → Vercel environment variables so `vite build` picks them up.  A stale client bundle after a rotation is fixed by redeploying.
- **Build-time migration** (`site/scripts/migrate.mjs`, run as `db:migrate` during `npm run build`): reads `DATABASE_URL` from the build environment (Vercel), same sync as above.
- **Build-time constants that never change at runtime** (route paths, OAuth endpoint path templates, preview allowlist `*.grok-sandbox.com`, P2P poll intervals): stay in code.

## Runtime contract

1. **Load at startup.**  `site/src/lib/settings.server.ts` exports a singleton built on the shared `createInfisicalSettings` client (`@jaywedgeworth22/congress-trading-shared`).  The module's top-level await runs `initSettings()` before any importer reads settings, so the full secret set for the matching environment is in an in-memory cache before the first request.  When the bootstrap identity IS configured but Infisical cannot be reached, boot fails fast.  Missing required keys throw an error naming the key and pointing here.
2. **Never fetch per-request.**  `settingsValue()` / `settingsRequired()` / `settingsFlag()` read memory (or the degraded `process.env` fallback) ONLY.  They never touch the network and are safe in hot paths.  The Datadog server module merges the cache over `process.env` in memory (`currentDatadogEnv()`) for the same reason.
3. **Background refresh.**  The client refreshes every 5 minutes and on `SIGHUP`.  Refresh failures log loudly and keep serving the last-known-good cache — staleness is safer than an outage.  Admins can also force a reload from the settings console.
4. **Write-through on admin save.**  The admin console (`/admin/settings`, server functions in `site/src/lib/settings-admin.ts`) calls the client's `set()`, which PATCHes Infisical FIRST and only then updates the local cache.  A failed Infisical write fails the save — the cache and Infisical never diverge silently.

## Admin gating

This is a single-owner personal site with no role system: **the signed-in
owner IS the admin** (documented here per the fleet pattern).  Every admin
server function runs behind `authMiddleware`, which rejects signed-out
callers with 401 before any handler runs; the `/admin/settings` UI renders
nothing for signed-out visitors (they are bounced to sign-in).  The
inventory endpoint returns key NAMES and presence metadata only — secret
values are never sent to the client, and the UI never displays them (values
are typed blind when rotating).

## Degraded mode

When `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` are not set (local
`npm run dev`, live-preview sandbox), settings resolve to `null` and every
read falls back to `process.env` — the app keeps its existing zero-config
behavior (PGLite, preview auth client, dark Datadog).  This is loud (a
startup warning) and intentional: it is the documented local-dev path, not a
silent failure.  Write-through and reload are disabled in degraded mode and
fail with a clear error instead of pretending to save.

## Rotating a value

1. Open `/admin/settings` while signed in, find the key, choose Rotate/Set, type the new value, Save.  The save writes to Infisical first, then updates the running cache — no redeploy needed for server-side keys.
2. For client-bundle keys (`DD_APPLICATION_ID`, `DD_CLIENT_TOKEN`, `VITE_*`): rotate in Infisical (or the admin console), then redeploy so `vite build` bakes the new values.  Confirm the Infisical → Vercel env sync picked them up before deploying.
3. `BETTER_AUTH_SECRET` rotation invalidates existing sessions (users sign in again).  `DATABASE_URL` rotation takes effect on the next background refresh (≤ 5 min) or an immediate Reload.
4. Never commit a real value to the repo, `.env.example`, logs, or chat.  `scripts/verify-infisical-sot.mjs` (CI) lints for direct `process.env` reads of migrated keys and for secret-shaped values in the settings modules.

## Files

- `site/src/lib/settings.server.ts` — singleton service, inventory, sync readers.  The ONLY module allowed direct `process.env` reads for migrated keys.
- `site/src/lib/settings-admin.ts` — admin server functions (inventory GET, write-through POST, reload POST), all behind `authMiddleware`.
- `site/src/routes/admin.settings.tsx` — the admin console UI (owner only).
- `site/tests/unit/settings.test.ts` — contract tests (mocked network): startup load, zero-network reads, write-through ordering, failed-refresh keeps last-known-good, failed write rejects, inventory never leaks values.
- `scripts/verify-infisical-sot.mjs` — CI lint for the pattern.
- `site/.env.example` — local dev overrides (no real values).
