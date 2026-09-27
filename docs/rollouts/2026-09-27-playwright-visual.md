# Playwright visual regression — 2026-09-27

Fleet-wide rollout of automated visual verification (owner directive 2026-09-27: automated-only; the owner never takes manual screenshots and does not run local UI preview sessions).

## What changed

- `site/tests/e2e/visual.spec.ts` — two Playwright screenshot assertions:
  - Homepage (`/`) full-page, with `#activity` (live digest feed) and `#media` (Sketchfab/YouTube embeds) masked.
  - Terms of service (`/terms-of-service`) full-page.
- `site/tests/e2e/visual.spec.ts-snapshots/` — committed baselines (`homepage-chromium-linux.png`, `terms-of-service-chromium-linux.png`).
- `AGENTS.md` — new "Visual verification" section documenting the automated-only policy.
- `docs/EFFORT-LOG.md` — this entry.

## Determinism notes

- `animations: 'disabled'` freezes the morphing hero/name animations.
- A `settlePage` helper scrolls through the page so `loading="lazy"` images (app icons, social icons) fetch, then waits for every image to complete before capturing.
- No workflow changes needed: the `e2e` job in `site-ci.yml` already runs `npx playwright test`.

## Verification

- Baselines generated locally in headless Chromium (`--update-snapshots`): 2 passed.
- Second run against committed baselines: 2 passed.
- PR opened with auto-merge armed per the standing always-auto-merge rule.
