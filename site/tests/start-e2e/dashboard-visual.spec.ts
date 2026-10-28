import { test, expect } from "@playwright/test";
import { mockFleetApis } from "./fixtures";

// Live regions that change with wall-clock time or relative-time rendering.
// Masking keeps the layout (box size/position) asserted while ignoring the
// volatile text inside.
const LIVE_MASK = [
  "#greeting", // "Good morning/afternoon/evening, Jay."
  "#date", // changes daily
  "#time", // clock, ticks every second
  "#meridiem",
  "#utc",
  "#zone",
  "#central",
  "#quota-meta", // "live · <relative> ago"
  "#rag-meta", // "live · <relative> ago · <n> pts"
  "#rag-snap-date", // hour-precision reading time
  "#quotas-body .quota-status", // "in <relative>" reset countdowns
];

test("dashboard visual", async ({ page }, testInfo) => {
  await mockFleetApis(page);
  if (testInfo.project.name === "chromium-dark") {
    // The app defaults to theme "light" (stored in localStorage); seed the
    // dark choice so the dark project exercises the real dark theme path.
    await page.addInitScript(() => {
      localStorage.setItem(
        "jay-safari-start-v1",
        JSON.stringify({ theme: "dark" }),
      );
    });
  }
  await page.goto("/");

  // Wait for the mocked panels to render before capturing.  One row per quota
  // window under a provider header — see dashboard.spec.ts.
  await expect(page.locator("#quotas-body .quota-row.sub")).toHaveCount(11);
  // 5 components: four ship an app icon, one (a shared library) keeps the
  // monogram tile, so the card shows both treatments in one baseline.
  await expect(page.locator("#rag-components .comp-card")).toHaveCount(5);
  await expect(page.locator("#grid section")).toHaveCount(3);

  await expect(page).toHaveScreenshot("dashboard.png", {
    fullPage: true,
    mask: LIVE_MASK.map((selector) => page.locator(selector)),
  });
});
