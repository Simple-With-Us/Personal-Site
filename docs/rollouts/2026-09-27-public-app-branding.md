# Public app catalog and branding — 2026-09-27

The personal portfolio now shows 11 app families in Coding, Financial, and Utility.  Usage Monitor has one family card with separate Client and Local links and distinct native icons.  The other ten app families each have a card.  Product websites and public source links are shown where available; release details remain on Simple With Us pages.

The Socratic Trade icon comes from the current iOS app icon.  Usage Client and Usage Local use their respective iOS app icons.  Harness uses a plain typographic HARNESS treatment shared with the Simple With Us catalog because its repository has no standalone wordmark asset without the MiniMax symbol or whale.  The Simple With Us links show the complete official wordmark with Jay's signature from `assets/logos/swu-logo-wide.png` in the Simple With Us repository.  No logo artwork was invented for this site.

Card copy states a concrete user action and omits unverified distribution claims.  The page retains Jay's About, media, activity, and social content.  The public boundary checker now asserts the 11-family roster, both Usage edition links and icons, the three categories, and branded assets.

Local verification: `node scripts/verify-public-boundary.mjs`, `npm run typecheck --prefix site`, `npm run lint --prefix site`, and `npm run build:dev` passed.  The existing lint warnings remain.  Browser review at desktop and 390 px found all 11 cards, separate Usage edition destinations, no horizontal overflow, and the complete Simple With Us logo.  The local Playwright smoke test could not launch because its Chromium binary is absent; the PR's Site CI installs Chromium and runs that test.

Production deployment and live page verification are recorded separately after merge.
