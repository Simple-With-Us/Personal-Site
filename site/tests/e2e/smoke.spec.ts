import { test, expect } from '@playwright/test';

// Fleet rollout scaffold: one smoke test. Visits /, expects HTTP 200 and a
// non-empty <title>. Expand into a real suite as the app needs it.
test('homepage smoke: HTTP 200 and non-empty title', async ({ page, request }) => {
  // The dev server compiles on first request; poll until it serves, warming
  // the server for the visual specs that run after (workers: 1).
  await expect(async () => {
    const res = await request.get('/');
    expect(res.status(), 'GET / should return HTTP 200').toBe(200);
  }).toPass({ timeout: 60000 });
  await page.goto('/');
  await expect(page, 'page should have a non-empty <title>').toHaveTitle(/.+/);
});
