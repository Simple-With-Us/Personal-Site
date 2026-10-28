// Regression cover for the Fleet RAG Components card reading 0 for live apps.
//
// The card once looked corpus points up by `acronym.toLowerCase()` and
// `name.toLowerCase()`.  Neither is a corpus slug: the corpus files
// Socratic.Trade under "socratic-trade", "Usage Monitor" under
// "usage-monitor", and the coordinator under the "fleet" bucket.  Every lookup
// missed, and the card fell through to 0 for components holding tens of
// thousands of points.  The real corpus key is now stated per component as
// `slug`, and these tests hold that contract in place.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { attachHits, slugify, COMPONENTS } from "../scripts/build-rag-snapshot.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The shape corpus.by_app actually has: hyphenated lowercase slugs.
const BY_APP = {
  fleet: 7667,
  "socratic-trade": 22564,
  "congress-trade": 8488,
  "congress-trading-shared": 588,
  "usage-monitor": 4754,
  dealdex: 1700,
  botfleet: 11703,
  "personal-site": 424,
  "fleet-ops": 637,
  autorotate: 929,
  contactlogo: 832,
  clutch: 84,
  other: 2488,
};

test("slugify turns display names into corpus-shaped slugs", () => {
  assert.equal(slugify("Socratic.Trade"), "socratic-trade");
  assert.equal(slugify("Usage Monitor"), "usage-monitor");
  assert.equal(slugify("  Congress.Trade  "), "congress-trade");
  assert.equal(slugify("Personal-Site"), "personal-site");
  assert.equal(slugify("fleet_ops"), "fleet-ops");
  assert.equal(slugify(null), "");
});

test("every roster component resolves a non-zero count against the real corpus", () => {
  const rows = attachHits(COMPONENTS, BY_APP);
  const zeroes = rows.filter(r => !r.hits).map(r => `${r.acronym} (${r.name})`);
  assert.deepEqual(zeroes, [], `components resolved to zero: ${zeroes.join(", ")}`);

  // Spot-check the four that used to read 0, against the counts the corpus
  // itself reports.
  const by = Object.fromEntries(rows.map(r => [r.acronym, r.hits]));
  assert.equal(by.ST, 22564);
  assert.equal(by.CT, 8488);
  assert.equal(by.UM, 4754);
  assert.equal(by.AFC, 7667); // filed under the "fleet" bucket
});

test("hits come from the stated slug, not the display name or monogram", () => {
  // A name that deliberately differs from the slug must still resolve.
  const rows = attachHits(
    [{ acronym: "ZZ", name: "Totally Different Name", slug: "socratic-trade" }],
    BY_APP,
  );
  assert.equal(rows[0].hits, 22564);
});

test("an unresolvable slug reports 0 without inventing a number", () => {
  const rows = attachHits([{ acronym: "QQ", name: "No Such App" }], BY_APP);
  assert.equal(rows[0].hits, 0);
});

test("the committed snapshot has no component sitting at zero", () => {
  const snap = JSON.parse(fs.readFileSync(path.join(root, "start/site-snapshot.json"), "utf8"));
  const zeroes = (snap.components || [])
    .filter(c => !c.hits)
    .map(c => `${c.acronym} (${c.name})`);
  assert.deepEqual(
    zeroes, [],
    `site-snapshot.json reports zero for ${zeroes.join(", ")}; ` +
    "rebuild it with `node scripts/build-rag-snapshot.mjs` after the slug fix",
  );
});