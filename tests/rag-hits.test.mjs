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

import { attachHits, slugify, COMPONENTS, cfHeaders } from "../scripts/build-rag-snapshot.mjs";

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

// The committed snapshot is decoded and then checked,  not trusted:  a
// snapshot whose shape drifted must fail here with the field named,  rather
// than pass because the assertion below happened to read nothing.
function validateSnapshot(snap) {
  assert.ok(snap && typeof snap === "object" && !Array.isArray(snap), "the snapshot must be an object");
  assert.ok(Array.isArray(snap.components), "the snapshot must carry a components array");
  for (const c of snap.components) {
    assert.ok(c && typeof c === "object" && !Array.isArray(c), "every component must be an object");
    for (const field of ["acronym", "name", "tagline", "slug"]) {
      assert.equal(typeof c[field], "string", `component ${c.acronym ?? "?"} must carry a string ${field}`);
      assert.ok(c[field].length > 0, `component ${c.acronym ?? "?"} must carry a non-empty ${field}`);
    }
    // An internal component with no public site carries a null url,  and one
    // with no brand mark carries a null icon.  Every other component names
    // both.
    for (const field of ["url", "icon"]) {
      if (c[field] === null) continue;
      assert.equal(typeof c[field], "string", `component ${c.acronym} must carry a string ${field}`);
      assert.ok(c[field].length > 0, `component ${c.acronym} must carry a non-empty ${field}`);
    }
    assert.equal(typeof c.hits, "number", `component ${c.acronym} must carry a numeric hits count`);
    assert.ok(
      Number.isInteger(c.hits) && c.hits >= 0,
      `component ${c.acronym} must carry a non-negative whole hits count`,
    );
  }
  return snap;
}

test("the committed snapshot has no component sitting at zero", () => {
  const snap = validateSnapshot(
    JSON.parse(fs.readFileSync(path.join(root, "start/site-snapshot.json"), "utf8")),
  );
  const zeroes = (snap.components || [])
    .filter(c => !c.hits)
    .map(c => `${c.acronym} (${c.name})`);
  assert.deepEqual(
    zeroes, [],
    `site-snapshot.json reports zero for ${zeroes.join(", ")}; ` +
    "rebuild it with `node scripts/build-rag-snapshot.mjs` after the slug fix",
  );
});

test("the committed snapshot carries the fields the components card reads", () => {
  const snap = validateSnapshot(
    JSON.parse(fs.readFileSync(path.join(root, "start/site-snapshot.json"), "utf8")),
  );
  assert.ok(snap.components.length > 0, "the snapshot must carry at least one component");
});
test("a missing corpus credential is named, not downgraded to a warning", () => {
  const saved = { ...process.env };
  try {
    delete process.env.CF_ACCESS_CLIENT_ID;
    delete process.env.CF_ACCESS_CLIENT_SECRET;
    delete process.env.RECALL_API_TOKEN;
    assert.throws(() => cfHeaders(), (err) => {
      for (const name of ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "RECALL_API_TOKEN"]) {
        assert.ok(
          err.message.includes(name),
          `the error must name ${name}, not the downstream failure: ${err.message}`,
        );
      }
      return true;
    });
  } finally {
    for (const key of ["CF_ACCESS_CLIENT_ID", "CF_ACCESS_CLIENT_SECRET", "RECALL_API_TOKEN"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
