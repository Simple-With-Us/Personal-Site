# 2026-10-28 — The Start Site Moves to Personal-Site

## Summary

`start.jays.services` now lives in this repository instead of the private `Fleet-OPS` repository.  The source sits under `start/`, the Vercel project `prj_mb1aSPLMPQyZFNXOnQI92wjyub5l` is relinked to `Simple-With-Us/Personal-Site` with root directory `start`, and the deployment protection stays exactly as it was.

The move happened because `Fleet-OPS` was a repository on the owner's personal GitHub account, and that account's Actions minutes were exhausted:  every workflow run in it failed in about two seconds without starting a single step.  The repository was transferred into the `Simple-With-Us` organization as a private repository, which ends the personal-account quota as the billing pool, and the shared workflows it carried moved to public repositories, where Actions minutes are not drawn from that pool at all.

The RAG snapshot the start site serves moved with it.  `start/site-snapshot.json` is refreshed daily by `.github/workflows/refresh-rag-snapshot.yml` in this repository, which uses the `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` and `RECALL_API_TOKEN` repository secrets.  The snapshot and the function that serves it, `start/api/rag-snapshot.js`, now sit together, so there is no cross-repository fetch between the corpus and the page that renders it.

## What Moved

- `start/public/`, `start/api/`, `start/vercel.json`, `start/vercel-ignore.sh`, `start/.vercelignore` and `start/site-snapshot.json` — the site, its three serverless handlers and its deployment inputs.
- `scripts/build-rag-snapshot.mjs` — the snapshot builder.  It writes `start/site-snapshot.json` now, and `SNAPSHOT_OUT` overrides the destination.
- `scripts/sync-logos.mjs` — the brand-asset sync, now writing `start/public/logos`.
- `scripts/deploy/vercel-config.start.json` — the deploy configuration for the start project.  The main site's configuration beside it is unchanged.
- `tests/deployment-boundary.test.cjs`, `tests/rag-hits.test.mjs`, `tests/admin-api.test.cjs`, `tests/quota-groups.test.cjs` and `tests/start-site-identity.test.cjs` — the site's boundary, handler and snapshot tests.
- `site/tests/start-e2e/` with `site/playwright.start.config.ts` — the dashboard specs and their committed screenshot baselines.

## What This Repository Already Had

The start site's catch-up machinery was already here for the main site:  `scripts/deploy/vercel-catch-up.mjs`, its test and `scripts/deploy/vercel-config.json`.  The script now takes its configuration path from `VERCEL_CONFIG_PATH` and falls back to `scripts/deploy/vercel-config.json`, so the main site's behaviour is unchanged.  `.github/workflows/vercel-catch-up-start.yml` is the start site's equivalent, shaped exactly like the main site's catch-up beside it.

Both catch-up workflows run their test job and skip the deploy, because the `VERCEL_CATCH_UP_ENABLED` repository variable is unset in every repository.  That is intentional, and it is also why the start site's own last real deployment predates this move: the site's day-to-day publisher has always been Vercel's Git integration, which builds and deploys a push to the linked repository's production branch.  The start project's Git integration is enabled and now points at this repository, and `start/vercel.json` restricts it to `main`, the same shape the main site uses.

## Verification

- `node --test scripts/deploy/vercel-catch-up.test.mjs` passes (13 tests).
- The start site's own tests pass (27 tests):  the deployment boundary, the RAG snapshot shape, the admin handler, the quota panel and the start page identity.
- The Vercel project reports `rootDirectory` `start`, a GitHub link to `Personal-Site` with repository id `1331389993`, production branch `main`, Git deployments enabled, `ssoProtection.deploymentType` `all`, and all twelve project environment variables intact.
- `https://start.jays.services/` answers with a redirect to `vercel.com/sso-api`, which is the Vercel Authentication gate.  That protection was not rebuilt or reconfigured; it belongs to the project and travelled with the relink.

## Open Items

- The Vercel team is on the Hobby plan, which cannot link a private repository owned by an organization.  That is why the old link to `Fleet-OPS` stopped being valid the moment the repository moved into the organization, and why the start site is served from a public repository.  A private start site would need a paid plan or a different host.
- The catch-up publisher cannot run while Vercel's Git integration is enabled:  the gate refuses with "Disable competing Git publisher before activation".  That is the intended safety behaviour, and it is why the gate is left as it is rather than relaxed.
