import { test, expect, type Page } from '@playwright/test';

// Visual regression for the Personal-Site pages.  Baselines are committed
// under ./visual.spec.ts-snapshots and compared on every CI run.  Dynamic
// regions are masked, never snapshotted raw: the activity feed varies with
// the live digest API, and the media section embeds third-party iframes
// (Sketchfab, YouTube) whose content is outside our control.
const DIGEST_URL = 'https://jaywedgeworth22.github.io/AI-Fleet-Coordinator/digest.md';

// The fleet digest is a live network fetch: abort it so the activity feed
// always renders its deterministic fallback, in CI and locally alike.
// (The section is masked regardless; this keeps page height stable too.)
// Must be called before page.goto().
async function blockDigest(page: Page) {
  await page.route(DIGEST_URL, (route) => route.abort());
}

async function settlePage(page: Page) {
  // App icons and social icons are loading="lazy", so they only fetch near
  // the viewport.  Walk to the bottom to trigger every image, wait for them
  // to finish, then return to the top before capturing.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page
    .waitForFunction(
      () =>
        Array.from(document.querySelectorAll('img')).every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe('visual', () => {
  test('homepage', async ({ page }) => {
    await blockDigest(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await settlePage(page);
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      animations: 'disabled',
      mask: [page.locator('#activity'), page.locator('#media')],
    });
  });

  test('terms of service', async ({ page }) => {
    await page.goto('/terms-of-service');
    await page.waitForLoadState('networkidle');
    await settlePage(page);
    await expect(page).toHaveScreenshot('terms-of-service.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
