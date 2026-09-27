# Public portfolio boundary and catalog links (2026-09-26)

## Scope

Codex updated the Personal-Site TanStack source on `codex/web-assets-improvements` after the private Fleet-OPS web-assets audit.  The change keeps the existing personal identity, work history, social links, media, public activity digest, domains, and telemetry while narrowing the public work surface.

## Changes

- Reduced the Work section to six public projects with outcome-focused descriptions.
- Added product or catalog Details/Open actions and public GitHub Source links.
- Removed the Fleet Ops card, operator host references, and the local duplicated TestFlight list.
- Added an honest availability section linking to Simple With Us for current platform and beta facts.
- Added a checked-in projection of verified Simple With Us page and product links without copying release availability facts.
- Filtered Fleet Ops and internal host destinations from activity rendering as a public-boundary guard.
- Added visible keyboard focus outlines and simplified navigation labels.
- Replaced the public `/start/` operator bookmark page with a minimal redirect to `home.jays.services`.
- Removed the public AGENTS link to the private Fleet-OPS routing documentation.

## Validation

Cheap checks passed for `git diff --check` and `node scripts/verify-public-boundary.mjs`, which scans all text under `site/src` and `site/public` plus public `AGENTS.md` for private destinations and duplicate beta invites.  GitHub CI passed typecheck, lint, build, Playwright e2e, verify, and gitleaks.  PRs #96 and #99 merged as `af968ba8` and `73b9872e`; the one-time manual Vercel deployment `3hNFiCaAcZBGGuuTpKvAo9imiTLR` is Ready/Production with `jaywedgeworth.com` assigned.  Both public domains returned HTTP 200 HTML with six public projects and the exact Sketchfab model URL; no FleetOPS/private-board URL or effort-board text was observed.  No DNS change, snapshot rewrite, or telemetry change was made.
