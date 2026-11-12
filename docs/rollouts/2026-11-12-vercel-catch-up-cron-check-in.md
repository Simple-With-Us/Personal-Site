# 2026-11-12 — Vercel catch-up cron check-ins

## Summary

FLEET-INFRA-EY (`ci-personal-site-vercel-production-catch-up`) and FLEET-INFRA-G7 (`ci-personal-site-vercel-production-catch-up-start`) are missed Sentry check-ins.  Both monitors expect `41 * * * *` with a 15-minute margin and a 60-minute max runtime.  The catch-up runs themselves succeed.

`gh run list` for the two schedule workflows, from 2026-10-28 through 2026-11-11, shows 54 and 55 successful schedule runs and no failures.  `gh run view --log-failed` on the latest run of each is empty.  The gaps between those runs are 3.35h to 10.62h, median about 6.4h.  The start minute is anywhere in a 30-minute band around :41, so a 15-minute margin misses most of the runs that do happen, and every hour that never starts is a miss.

The shared reporter in AI-Fleet-Coordinator does send a paired `in_progress` / `ok` check-in on the right slug when its job runs (HTTP 200, same check-in id).  It also upserts the hourly crontab with the hardcoded 15-minute margin, and this repository cannot pass a different margin.  Leaving the workflows on that listener would put the false schedule back on the next run.

## What changed

`scripts/deploy/sentry-cron-checkin.mjs` checks in from each catch-up workflow.  The slug is `ci-personal-site-` plus the slug of that workflow's name, which is the slug the monitor already has.  Open and close use one id derived from the run.  The status is `ok` when the test succeeded and the deploy succeeded, was skipped, or was cancelled, and `error` when a job failed.  A skipped deploy is the clean no-op while `VERCEL_CATCH_UP_ENABLED` is unset.

Sentry's schedule for these two monitors is an interval of 12 hours plus a 120-minute margin (a miss after 14 hours).  That covers the measured gaps and still alerts inside a day if the schedule stops.  The GitHub crontab stays `41 * * * *`, because that is the retry cadence for a quiet main branch, not the cadence Actions delivers.

The two workflows are no longer in `.github/workflows/sentry-ci-report.yml`.  A real failure still sends the `ci-failure` event with the same fingerprint the shared reporter used, including for a non-schedule run.  `scripts/verify-sentry-ci-report.py` rejects putting a self-reporting workflow back on the listener.

## Orphaned monitors

Neither monitor is orphaned.  `ci-personal-site-vercel-production-catch-up-start` is the start-site workflow's own monitor, not a split of the main check-in, and it keeps receiving check-ins.  Nothing new needs to be disabled.

## Verification

`node --test scripts/deploy/vercel-catch-up.test.mjs scripts/deploy/sentry-cron-checkin.test.mjs` and `python3 scripts/verify-sentry-ci-report.py`.  The check-in script exits 0 when `SENTRY_FLEET_DSN` is absent, and it does not print the DSN.
