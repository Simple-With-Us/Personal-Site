# Status

- 2026-09-26: Codex portfolio boundary pass is completed and deployed from PRs #96 and #99 (`af968ba8`, `73b9872e`).  Vercel deployment `3hNFiCaAcZBGGuuTpKvAo9imiTLR` is Ready/Production with `jaywedgeworth.com` assigned; `jays.services` and `jaywedgeworth.com` both served the six public projects, exact Sketchfab model URL, and `/start/` redirect without FleetOPS/private-board URLs or effort-board text.  No DNS change was made.
- 2026-09-17: Vercel Speed Insights is already on `main` (PR #70 squash `9c56966`, board `87efa14b`).  `@vercel/speed-insights/react` in `__root.tsx`.  Live `/_vercel/speed-insights/script.js` HTTP 200.  vercel-ignore-hourly `:(top)` pathspec is PR #61 (`1dd093f`, board `298e80ed`).  No duplicate Speed Insights PR.
- 2026-09-14: Host Claude's Safari start page at `/start/` for iPhone Add to Home Screen.  Source of truth is AFC `scripts/safari-start`.  Board `970746b9`.  Branch `fx/safari-start`.
- 2026-09-13: Vercel production deploys only when `site/` changed, at most once per hour.  Previews skipped.  Stops agent spam of empty Hobby builds.  Board `0934111e`.  Branch `fx/vercel-skip-pointless`.
- 2026-09-13: Merge to `main` is Vercel production.  `vercel-ignore-hourly.sh` only skips preview auto-deploys (owner: sites go live on merge).  Board `ef71d6c1`.  Branch `fx/merge-equals-live`.
- 2026-09-13: Stopped advertising Autorotate.Codes as a live host (NXDOMAIN).  Project card and digest now say Autorotate; TestFlight row is Autorotate (iOS).  Added Hog Hunter as a local-only Mac utility.  Apex `jays.services` is Vercel behind Cloudflare.  Board `56fea494`.  Branch `fx/dead-links-hoghunter`.
- 2026-09-07: Updated BotFleet app logo with official 1024px icon (bf.png), removed Socratic Trade iOS TestFlight links from project card and beta grid, polished all app blurbs with domain hyperlinks and tighter summaries, and fixed prefer-const in fleet-digest.ts.  Merged PR #65 (commit `364dad1`) and deployed to Vercel production (`dpl_FV5tML6Y5oq1mDyf8hNHFBtZX3Ve` on `https://jays.services`).
- 2026-09-01: Observability is Datadog only.  There is no Sentry project for
  `jays.services`.  A tiny unhandled-window-error Sentry project is not
  wanted.  Board `ca3e27f0`.  Branch `grok/sentry-datadog-only`.  Merged PS #49.
- 2026-08-31: Added TestFlight Public Beta links across all fleet apps to jays.services (Socratic Trade, Congress.Trade, Usage Monitor Client/Local, Autorotate iOS/macOS, ContactLogo iOS/macOS, BotFleet iOS/macOS). Added TestFlight badges to project cards and created dedicated TestFlight Public Betas showcase section.
- 2026-08-26: Add PERSONALSITE_DD_* prefixed key support and sync all app Datadog secrets into the Infisical shared workspace (shared-at-ct).
- 2026-08-26: DealDex logo updated with official 1024px icon.  Added CTS acronym for Congress Trading Shared fallback.  Fixed Datadog fail-closed throwing on production builds so Vercel Production deploys successfully.
- 2026-08-25: Project domains, hyperlinking, and top-right card buttons.  Project blurbs format domain names in exact PascalCase/canonical forms (DealDex.net, Autorotate.Codes, Congress.Trade, SocraticTrade.com, ContactLogo.com, usage.jays.services).  Domain names in descriptions are rendered as blue un-underlined hyperlinks.  Project cards use top-right action buttons with a right arrow and GitHub logo.  Congress Trading Shared added to project list.  Static snapshot synchronized.
- 2026-08-25: Designer leftover UX — visitor work blurbs + ContactLogo / Fleet
  icons.  No Next.js / Coolify / "30+" on cards.  CL / FL initial badges
  gone.  Copy and icons only.  Datadog #19 untouched.  Do not deploy.
- 2026-08-25: Datadog logs + APM + RUM on the existing account.  Fail closed
  in production if `DD_API_KEY` / `DD_SITE` / `DD_APPLICATION_ID` /
  `DD_CLIENT_TOKEN` are missing.  Replay off.  No Sentry project.
- 2026-08-22: Vercel Web Analytics — `@vercel/analytics` mounted in TanStack Start root (`@vercel/analytics/react`, not `/next`).  Counts after production deploy + visit.
- 2026-08-22: GitHub `main` synced.  Personal Vercel Hobby project `personal-site` (`jayw`) production READY at https://personal-site-jayw.vercel.app/ (About copy + Doximity view URL verified).  Apex `jays.services` cutover to Vercel behind Cloudflare is done (see 2026-09-13).  Drive backups: coordinator launchd + GHA artifacts.  Hobby usage is negligible.
- 2026-08-20: Public work list copy matches current apps.  Socratic Trade is production at socratictrade.com (Coolify), from that README.  Congress.Trade names congress.trade.  DealDex and ContactLogo cards added from their live repo copy.
- GitHub repo About sidebar still says "automatic snapshot".  This seat cannot edit that field (read-only `gh`).
