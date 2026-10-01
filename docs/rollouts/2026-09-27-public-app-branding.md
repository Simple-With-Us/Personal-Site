# Public app catalog and branding — 2026-09-27

The personal portfolio now shows 11 app families in Coding, Financial, and Utility.  Usage Monitor has one family card with separate Client and Local links and distinct native icons.  The other ten app families each have a card.  Product websites and public source links are shown where available; release details remain on Simple With Us pages.

The Socratic Trade icon comes from the current iOS app icon.  Usage Client and Usage Local use their respective iOS app icons.  Clutch uses its placeholder C monogram icon (`assets/clutch-icon.svg` in the Clutch repository), which carries no third-party mark.  The Simple With Us links show the complete official wordmark with Jay's signature from `assets/logos/swu-logo-wide.png` in the Simple With Us repository.  No logo artwork was invented for this site.

Card copy states a concrete user action and omits unverified distribution claims.  The page retains Jay's About, media, activity, and social content.  The public boundary checker now asserts the 11-family roster, both Usage edition links and icons, the three categories, and branded assets.

Local verification: `node scripts/verify-public-boundary.mjs`, `npm run typecheck --prefix site`, `npm run lint --prefix site`, and `npm run build:dev` passed.  The existing lint warnings remain.  Browser review at desktop and 390 px found all 11 cards, separate Usage edition destinations, no horizontal overflow, and the complete Simple With Us logo.  The local Playwright smoke test could not launch because its Chromium binary is absent; the PR's Site CI installs Chromium and runs that test.

PR #102 merged as `28cfbe00f8bd3af2b2fddddacc5496202c8093c7`.  Vercel production deployment `dpl_9HnXAm1Bq6YpZVYuk7EacYrUBjQs` reached Ready for that exact commit.  Both `https://jays.services/` and `https://jaywedgeworth.com/` served the new catalog with the full Simple With Us logo path and separate Usage edition links.  The live logo matched the checked-in PNG byte-for-byte; both Usage icons returned HTTP 200.  Site CI, including its Playwright smoke test, passed on the PR.
