// Cover for the Fleet RAG panel, which reads the private services live.
//
// The panel used to serve start/site-snapshot.json, a snapshot committed to this
// public repository.  That file carried the fleet's board item titles, so the
// repository published them whatever the site did.  The panel now reads the
// corpus (behind Cloudflare Access) and the board (Linear) at request time,
// and only the roster stays in the repository.  These tests hold that
// contract:  the shape the page reads, the corpus slug each app is counted
// under, the seat each board row is attributed to, and the fail-closed
// behaviour when an upstream is gone.
//
//   node --test tests/rag-hits.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROSTER = JSON.parse(fs.readFileSync(path.join(root, "start/site-roster.json"), "utf8"));

// The shape corpus.by_app actually has:  hyphenated lowercase slugs.
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

const STATS = {
  collection: "fleet-agents",
  status: "green",
  points: 65825,
  by_source: { board: 27046, doc: 28177 },
  by_app: BY_APP,
};

const ISSUES = {
  data: {
    issues: {
      nodes: [
        {
          id: "1",
          title: "The board rows the fleet closed out",
          updatedAt: "2026-10-28T17:43:14.332Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "seat:MM" }, { name: "agent-report" }] },
        },
        {
          id: "2",
          title: "A claimed row, and the claim is the better seat",
          updatedAt: "2026-10-27T12:00:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "claimed:CLAUDE" }, { name: "seat:MM" }] },
        },
        {
          id: "3",
          title: "Still in flight, so not a change yet",
          updatedAt: "2026-10-28T18:00:00.000Z",
          state: { name: "In Progress", type: "started" },
          labels: { nodes: [{ name: "seat:MM" }] },
        },
        {
          id: "4",
          title: "The owner's own item, with no seat to attribute it to",
          updatedAt: "2026-10-28T18:30:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "P1" }] },
        },
      ],
    },
  },
};

/** A fetch stub that answers the corpus call and the two board calls. */
function stubFetch({ stats = STATS, issues = ISSUES, fail = null } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    if (fail && target.includes(fail)) return { ok: false, status: 503, json: async () => ({}) };
    if (target.includes("/mcp")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: { content: [{ text: JSON.stringify(stats) }] } }),
      };
    }
    if (target.includes("/oauth/token")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "test-token" }) };
    }
    if (target.includes("/graphql")) {
      return { ok: true, status: 200, json: async () => issues };
    }
    throw new Error("unexpected fetch: " + target);
  };
}

/** Call the function with the fetch stubbed, and return the status and the body. */
async function callPanel({ env = {}, fetchStub = null } = {}) {
  // A fresh module per call:  the function keeps its own cache and its own
  // token, and a test that shared them would read the previous test's answer.
  const modulePath = path.join(root, "start/api/rag-snapshot.js");
  delete require.cache[require.resolve(modulePath)];
  const saved = { ...process.env };
  const savedFetch = globalThis.fetch;
  const headers = {};
  let status = 0;
  let body = null;
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    globalThis.fetch = fetchStub || stubFetch();
    const handler = require(modulePath);
    const res = {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    };
    await handler({ headers: { origin: "https://start.jays.services" } }, res);
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) delete process.env[key];
    }
    Object.assign(process.env, saved);
  }
  return { status, body, headers };
}

const FULL_ENV = {
  RECALL_API_TOKEN: "test-token",
  CF_ACCESS_CLIENT_ID: "test-id",
  CF_ACCESS_CLIENT_SECRET: "test-secret",
  LINEAR_CLIENT_ID: "test-id",
  LINEAR_CLIENT_SECRET: "test-secret",
};

test("the panel answers with the shape the page reads", async () => {
  const { status, body } = await callPanel({ env: FULL_ENV });
  assert.equal(status, 200);
  for (const field of ["generatedAt", "schema", "components", "seats", "recentChanges", "corpus"]) {
    assert.ok(field in body, `the panel must carry ${field}`);
  }
  assert.equal(body.schema, 2);
  assert.equal(body.corpus.points, 65825);
  assert.equal(body.corpus.collection, "fleet-agents");
});

test("the corpus slug decides the count, not the display name", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const afc = body.components.find((c) => c.acronym === "AFC");
  assert.ok(afc, "the roster must carry the coordinator");
  // The coordinator's name slugifies to something the corpus never files it
  // under;  only the stated slug finds its points.
  assert.notEqual(afc.slug, afc.name.toLowerCase());
  assert.equal(afc.hits, BY_APP[afc.slug]);
  assert.ok(afc.hits > 0, "a live app must not read zero");
});

test("every roster app resolves a count against the corpus's own keys", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const unresolved = body.components.filter((c) => c.hits == null).map((c) => `${c.acronym} (${c.name})`);
  assert.deepEqual(unresolved, [], `apps the corpus does not know: ${unresolved.join(", ")}`);
  const zeroes = body.components.filter((c) => !c.hits).map((c) => `${c.acronym} (${c.name})`);
  assert.deepEqual(zeroes, [], `apps the corpus counts at zero: ${zeroes.join(", ")}`);
});

test("a board row carries the seat, the day and the title", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  assert.equal(body.recentChanges.length, 2);
  const [first, second] = body.recentChanges;
  assert.equal(first.seat, "MM");
  assert.equal(first.date, "2026-10-28");
  assert.equal(first.title, "The board rows the fleet closed out");
  // A claim says who is on it;  a seat label says who reported it.
  assert.equal(second.seat, "CLAUDE");
  assert.equal(second.date, "2026-10-27");
});

test("a row that is still in flight is not a change yet", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const titles = body.recentChanges.map((r) => r.title);
  assert.ok(!titles.some((t) => t.includes("Still in flight")));
});

test("a row with no seat to attribute it to is left out", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const titles = body.recentChanges.map((r) => r.title);
  assert.ok(!titles.some((t) => t.includes("owner's own item")));
});

test("the seat bar counts the rows it sits next to", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const mm = body.seats.find((s) => s.tag === "MM");
  assert.equal(mm.recentCount, 1);
  const claude = body.seats.find((s) => s.tag === "CLAUDE");
  assert.equal(claude.recentCount, 1);
  const quiet = body.seats.find((s) => s.tag === "MONET");
  assert.equal(quiet.recentCount, 0);
});

test("an upstream that is gone answers 502, not an empty panel", async () => {
  const { status, body } = await callPanel({
    env: FULL_ENV,
    fetchStub: stubFetch({ fail: "recall.jays.services" }),
  });
  assert.equal(status, 502);
  assert.ok(body.error, "the answer must say what went wrong");
  assert.ok(!body.recentChanges, "a broken upstream must not read as a board with no work on it");
});

test("a missing credential is named, not downgraded to a warning", async () => {
  const { status, body } = await callPanel({
    env: { ...FULL_ENV, CF_ACCESS_CLIENT_ID: undefined },
  });
  assert.equal(status, 502);
  assert.ok(
    String(body.detail).includes("CF_ACCESS_CLIENT_ID"),
    `the error must name the missing credential: ${body.detail}`,
  );
});

test("the panel is served privately", async () => {
  const { headers } = await callPanel({ env: FULL_ENV });
  assert.equal(headers["cache-control"], "private, no-store");
  assert.equal(headers["access-control-allow-origin"], "https://start.jays.services");
});

test("the repository carries no board titles", () => {
  // The snapshot that used to hold them is gone, and the file that replaces it
  // holds the roster only:  app names, seat names and the counts the live
  // function fills in.
  assert.equal(
    fs.existsSync(path.join(root, "start/site-snapshot.json")),
    false,
    "start/site-snapshot.json must not come back:  it carried the fleet's board titles",
  );
  assert.equal(
    fs.existsSync(path.join(root, ".github/workflows/refresh-rag-snapshot.yml")),
    false,
    "the nightly snapshot workflow must not come back:  the panel reads live",
  );
  const rosterText = fs.readFileSync(path.join(root, "start/site-roster.json"), "utf8");
  assert.ok(!rosterText.includes("recentChanges"), "the roster must carry no board rows");
  assert.ok(!rosterText.includes("COMPLETED"), "the roster must carry no board titles");
});
