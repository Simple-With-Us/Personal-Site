# Harness renamed to Clutch — 2026-10-01

The portfolio's Coding card for the local agent app now reads Clutch and links to the public `jaywedgeworth22/Clutch` repository instead of Harness.  The card copy says "coding agent" in place of "agent harness", and its icon is the placeholder C monogram `site/public/app-icons/ck.svg` (from `assets/clutch-icon.svg` in the Clutch repository), which carries no third-party mark.  The retired `hr.svg` icon is removed.

The fleet activity digest parser now accepts `**CK**` and `**CLUTCH**` as the Clutch code and labels it Clutch.  `site.appIcons` maps both `CK` and the retired `HR` code to the Clutch icon, because older digest lines still say `HR` and Harness is the same app.  The public boundary checker expects the `ck` project key and the `ck.svg` icon.

The homepage visual baseline `site/tests/e2e/visual.spec.ts-snapshots/homepage-chromium-linux.png` was regenerated in a Linux Playwright container (v1.63.0, Ubuntu 24.04) so the committed rendering shows the Clutch card.

The earlier rollout `2026-09-27-public-app-branding.md` is unchanged.  It records PR #102, which shipped the Harness card, and stays accurate as history.
