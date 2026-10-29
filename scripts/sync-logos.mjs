#!/usr/bin/env node
// Sync every served brand asset in start/public/logos/ from its owning source.
//
// Two sources, and only two:
//
//   1. Provider / model marks come from CodeCaps —
//      CodeCaps/Sources/CodeCaps/Resources/ProviderMarks/.  Owner ruling
//      2026-10-11: the marks shown next to a quota row must be the ones
//      CodeCaps ships, not a second set re-derived from another app.  CodeCaps
//      serves its `<base>-color.png` in the default style, so those are the
//      files copied.  MiniMax is the exception CodeCaps documents itself: it
//      ships `minimax.png` and no MiniMax SVG.
//
//   2. App icons come from Personal-Site/static/app-icons/ — the owner's own
//      curated, full-resolution set for the product sites.  Each file there is
//      the app's own AppIcon asset; this repo only downscales it for a 36px
//      card, it never redraws it.
//
//      FleetLink is the one exception to that directory: its icon was never
//      copied into Personal-Site, so it is read from Simple-With-Us/assets/
//      app-icons/, which is the same owner's curated set (ATTRIBUTION.md there
//      credits every file to the owning app's 1024 AppIcon master).  It is the
//      owner's file, not art derived or generated here.
//
// Marks CodeCaps does not ship stay as they are, because nothing else owns
// them: DeepSeek and Kimi are real brands the fleet reports but CodeCaps does
// not poll, and Monet and Renoir are seats with no provider at all.
//
// Usage: node scripts/sync-logos.mjs [--check]

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

const CODE = "/Users/jay/Code";
const MARKS = `${CODE}/CodeCaps/Sources/CodeCaps/Resources/ProviderMarks`;
const APP_ICONS = `${CODE}/Personal-Site/static/app-icons`;
const APP_ICONS_SWU = `${CODE}/Simple-With-Us/assets/app-icons`;

// Served name -> source file.  App icons are downscaled to EDGE px; provider
// marks are copied at their shipped size (256px, or 640 for MiniMax).
const APPS = {
  "app-st.png": "st.png", // Socratic.Trade
  "app-ct.png": "ct.png", // Congress.Trade
  "app-um.png": "um.png", // Usage Monitor
  "app-bf.png": "bf.png", // BotFleet
  "app-dd.png": "dd.png", // DealDex
  "app-cl.png": "cl.png", // ContactLogo
  "app-ar.png": "ar.png", // Autorotate
  "app-ps.png": "ps.png", // Personal Site
  "app-afc.png": "fleet.png", // AI Fleet Coordinator
  "app-fl.png": `${APP_ICONS_SWU}/fleetlink.png`, // FleetLink (owner's set; see header)
};
const EDGE = 512;

const PROVIDERS = {
  "claude-color.png": "claude-color.png",
  "openai-color.png": "openai-color.png",
  "grok-color.png": "grok-color.png",
  "grok-bot-color.png": "grok-bot-color.png",
  "gemini-color.png": "gemini-color.png",
  "cursor-color.png": "cursor-color.png",
  "minimax.png": "minimax.png",
  "muse-assist-color.png": "muse-assist-color.png",
  "muse-code-color.png": "muse-code-color.png",
};

// Kept as-is: no CodeCaps equivalent exists for any of these.
const UNSOURCED = new Set(["deepseek.svg", "kimi.svg", "monet.svg", "renoir.svg"]);

const check = process.argv.includes("--check");
const outArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const OUT = resolve(outArg || "start/public/logos");
const scratch = mkdtempSync(join(tmpdir(), "fleet-ops-logos-"));
let changed = 0;
let problems = 0;

try {
  for (const [name, src] of Object.entries(APPS)) {
    const from = isAbsolute(src) ? src : join(APP_ICONS, src);
    if (!statSync(from, { throwIfNoEntry: false })) {
      console.error(`missing app icon source: ${from}`);
      problems++;
      continue;
    }
    const staged = join(scratch, name);
    copyFileSync(from, staged);
    const width = Number(
      execFileSync("sips", ["-g", "pixelWidth", staged], { encoding: "utf8" })
        .match(/pixelWidth:\s*(\d+)/)[1]
    );
    if (width > EDGE) execFileSync("sips", ["-Z", String(EDGE), staged]);
    report(name, staged);
  }
  for (const [name, src] of Object.entries(PROVIDERS)) {
    const from = join(MARKS, src);
    if (!statSync(from, { throwIfNoEntry: false })) {
      console.error(`missing provider mark: ${from}`);
      problems++;
      continue;
    }
    const staged = join(scratch, name);
    copyFileSync(from, staged);
    report(name, staged);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const served = new Set([
  ...Object.keys(APPS),
  ...Object.keys(PROVIDERS),
  ...UNSOURCED,
]);
for (const file of readdirSync(OUT).sort()) {
  if (!served.has(file)) {
    console.error(`stale file in ${OUT}: ${file} (no longer served; delete it)`);
    problems++;
  }
}

// sips stamps a creation time into every PNG it writes, so two runs over the
// same source produce different bytes and a byte comparison reports drift that
// is not there.  Comparing decoded pixels through a timestamp-free format is
// the only comparison that means what it says.
function pixelHash(file) {
  const bmp = join(scratch, `chk-${basename(file)}.bmp`);
  execFileSync("sips", ["-s", "format", "bmp", file, "--out", bmp]);
  const hash = execFileSync("shasum", [bmp], { encoding: "utf8" }).split(" ")[0];
  rmSync(bmp, { force: true });
  return hash;
}

function report(name, staged) {
  const dest = join(OUT, name);
  if (check) {
    if (!statSync(dest, { throwIfNoEntry: false })) {
      console.error(`MISSING  ${name}`);
      problems++;
      return;
    }
    if (pixelHash(dest) === pixelHash(staged)) {
      console.log(`ok       ${name}`);
      return;
    }
    console.error(`DRIFTED  ${name}`);
    problems++;
    return;
  }
  copyFileSync(staged, dest);
  changed++;
  console.log(`synced   ${name}  ${(statSync(dest).size / 1024).toFixed(1)} KB`);
}

console.log(
  check
    ? problems
      ? `\n${problems} problem(s): start/public/logos is not in sync with its sources`
      : "\nstart/public/logos matches every source"
    : `\n${changed} file(s) written to ${OUT}`
);
process.exit(problems ? 1 : 0);