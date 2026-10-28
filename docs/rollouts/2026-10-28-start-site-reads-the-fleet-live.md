# 2026-10-28 — The Start Site Reads The Fleet Live

## Summary

The Fleet RAG panel on `start.jays.services` used to serve `start/site-snapshot.json`, a file committed to this repository.  It held the fleet's board item titles, and this repository is public, so those titles were published to anyone who could read it.  The site's own gate was never the problem:  a gate protects a page, not a file in a public repository.

The panel now reads the private services at request time.  The board rows come from Linear through the fleet's own OAuth app, and the corpus counters come from recall behind Cloudflare Access.  Only the roster — the app list and the seat list, which the coordinator already publishes — stays in the repository, as `start/site-roster.json`.

## Why

Two facts drove the change.  The first is that a public repository publishes its contents whatever any Vercel, Cloudflare or HTTP gate does, so a committed snapshot of private board titles cannot be kept in one.  The second is that the snapshot had already failed in the way snapshots do:  the nightly refresh's staleness check refused to publish because the corpus's own board-source ingest stopped on Oct-18, and the daily run was about to start failing on the floor of ten days.  A file that has to be refreshed on a schedule is a file that will publish stale data or fail loudly.

Reading live removes both failure modes.  There is nothing to refresh, nothing to go stale in the repository, and the panel shows the board as it stands.

## What Changed

- `start/api/rag-snapshot.js` — rewritten to fetch.  It asks recall and Linear at the same time, merges the committed roster, and answers in exactly the shape the page already read:  `generatedAt`, `schema`, `components`, `seats`, `recentChanges` and `corpus`.  The page itself did not change.
- `start/site-roster.json` — new.  The roster only:  eleven apps with their acronym, name, tagline, slug and icon, and eight seats with their tag, full name, colour and mark.
- `start/site-snapshot.json`, `scripts/build-rag-snapshot.mjs` and `.github/workflows/refresh-rag-snapshot.yml` — deleted.  The snapshot, its builder and its schedule are gone together.
- `start/vercel.json` — the function's `includeFiles` now names `site-roster.json`, the one bundled input it is given on purpose.
- `start/.vercelignore` — the allowlist names `site-roster.json` in both the project-root and repository-root layouts, in place of the snapshot.
- `.github/workflows/ci.yml` — the required-files check names `start/site-roster.json`.
- `.github/workflows/sentry-ci-report.yml` — `refresh-rag-snapshot` is out of the observed workflow list and the mirrored cron map.  `scripts/verify-sentry-ci-report.py` fails CI when a named workflow no longer exists, so this was mandatory, not tidying.
- `tests/rag-hits.test.mjs` — rewritten around a stubbed `fetch`.  Eleven tests:  the shape, the corpus slug each app is counted under, the seat each row is attributed to, rows that are still in flight, rows with no seat, the seat counts, the private cache header, the 502 on a dead upstream, the named missing credential, and the guard that the repository carries no board titles.
- `tests/deployment-boundary.test.cjs` — the deployment allowlist fixture names `site-roster.json`, and the old "the snapshot API can read explicit bundled data" test is now "the panel reads the fleet live and no snapshot is published".

## The Credentials

The function reads five environment variables, and they are Vercel **project** environment variables, not repository secrets.  A repository secret would put the fleet's board credential in the public repository's settings, which is where the snapshot's problem used to live.

| Variable | What it is |
| --- | --- |
| `RECALL_API_TOKEN` | Bearer for the recall corpus |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access service token id for `recall.jays.services` |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access service token secret |
| `LINEAR_CLIENT_ID` | Linear OAuth client id, the fleet app |
| `LINEAR_CLIENT_SECRET` | Linear OAuth client secret |

The Linear scope string is a constant in the function:  `read,write,app:assignable,app:mentionable`, the board CLI's own scope.  Asking Linear for a token with a different scope revokes every token that app holds, so it is never read from the environment.

## How It Behaves

- A good answer is cached for sixty seconds, and a Linear token for fifteen minutes.
- When an upstream fails and the last good answer is under thirty minutes old, that answer is served with an `X-Rag-Stale` header that says how old it is.  A good answer beats an error page.
- When there is nothing to fall back on, the function answers `502` with the reason.  An upstream that is down for good must not look like a board with no work on it.
- The answer is served `private, no-store`, and the CORS origin is `https://start.jays.services` or `https://home.jays.services`.

## Verification

- `node --test tests/rag-hits.test.mjs` passes (11 tests).
- `node --test tests/deployment-boundary.test.cjs` passes (6 tests).
- `python3 scripts/verify-sentry-ci-report.py` passes:  eight observed workflows and four cron schedules match the live workflows.
- A live read was measured before the code was written:  recall's stats answer in about 0.35 seconds and the board in about a second, so both fit inside the function's ten-second budget.  The corpus's semantic board search takes two to four and a half seconds per query and is deliberately not on the per-request path.
- `https://start.jays.services/api/rag-snapshot` answers with live rows and live corpus counters.

## Open Items

- The repository secrets `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` and `RECALL_API_TOKEN` were used only by the deleted nightly workflow.  They can be removed from the repository's secrets once this lands.
- The corpus's own board-source ingest stopped on Oct-18.  That does not affect the panel any more, because the panel reads the board from Linear directly, but the corpus is still missing those points and the ingest is still worth repairing.
