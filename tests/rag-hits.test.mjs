// Cover for the Fleet RAG panel, which reads the private services live.
//
// The panel used to serve start/site-snapshot.json, a snapshot committed to this
// public repository.  That file carried the fleet's board item titles, so the
// repository published them whatever the site did.  The panel now reads the
// corpus (behind Cloudflare Access) and the board (Linear) at request time,
// and only the roster stays in the repository.  These tests hold that
// contract:  the shape the page reads, the corpus slug each app is counted
// under, the seat each board row is attributed to, the window the counts
// cover, and the fail-closed behaviour when an upstream is gone.
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

// A base URL that names no real service:  the address of the corpus lives in
// the project's environment,  not in a public repository.
const CORPUS = "https://corpus.invalid";

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
          completedAt: "2026-10-28T17:40:00.000Z",
          createdAt: "2026-10-20T09:00:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "seat:MM" }, { name: "agent-report" }] },
        },
        {
          id: "2",
          title: "A claimed row, and the claim is the better seat",
          updatedAt: "2026-10-27T12:00:00.000Z",
          completedAt: "2026-10-27T12:00:00.000Z",
          createdAt: "2026-10-19T09:00:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "claimed:CLAUDE" }, { name: "seat:MM" }] },
        },
        {
          id: "3",
          title: "Still in flight, so not a change yet",
          updatedAt: "2026-10-28T18:00:00.000Z",
          completedAt: null,
          createdAt: "2026-10-28T10:00:00.000Z",
          state: { name: "In Progress", type: "started" },
          labels: { nodes: [{ name: "seat:MM" }] },
        },
        {
          id: "4",
          title: "The owner's own item, with no seat to attribute it to",
          updatedAt: "2026-10-28T18:30:00.000Z",
          completedAt: "2026-10-28T18:30:00.000Z",
          createdAt: "2026-10-28T10:30:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "P1" }] },
        },
        {
          id: "5",
          title: "Finished last week and touched today, and the day it was finished is the day that counts",
          updatedAt: "2026-10-28T19:00:00.000Z",
          completedAt: "2026-10-21T08:00:00.000Z",
          createdAt: "2026-10-18T08:00:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "seat:MONET" }] },
        },
        {
          id: "6",
          title: "Minimax filed under its other name",
          updatedAt: "2026-10-28T19:30:00.000Z",
          completedAt: "2026-10-28T19:30:00.000Z",
          createdAt: "2026-10-25T08:00:00.000Z",
          state: { name: "Done", type: "completed" },
          labels: { nodes: [{ name: "seat:minimax" }] },
        },
      ],
    },
  },
};

/** A fetch stub that answers the corpus call and the two board calls. */
function stubFetch({ stats = STATS, issues = ISSUES, fail = null, sse = false, calls = null } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    if (calls) calls.push({ target, options });
    // The failure is matched on the path,  not on the address of the service:
    // the address is a private value and this repository is public.
    if (fail && target.includes(fail)) return { ok: false, status: 503, json: async () => ({}) };
    if (target.includes("/mcp")) {
      const payload = { result: { content: [{ text: JSON.stringify(stats) }] } };
      return {
        ok: true,
        status: 200,
        text: async () => (sse ? `data: ${JSON.stringify(payload)}\n\n` : JSON.stringify(payload)),
        json: async () => payload,
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
  // token,  and a test that shared them would read the previous test's answer.
  const modulePath = path.join(root, "start/api/rag-snapshot.js");
  delete require.cache[require.resolve(modulePath)];
  const saved = {};
  for (const key of Object.keys(env)) saved[key] = process.env[key];
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
    // Only the keys this test touched are restored:  the whole environment is
    // not this test's to copy.
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  return { status, body, headers };
}

const FULL_ENV = {
  RECALL_API_BASE: CORPUS,
  RECALL_API_TOKEN: "recall-token-abcdefgh",
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
  const mm = body.recentChanges.find((r) => r.title.startsWith("The board rows"));
  assert.equal(mm.seat, "MM");
  assert.equal(mm.date, "2026-10-28");
  // A claim says who is on it;  a seat label says who reported it.
  const claimed = body.recentChanges.find((r) => r.title.startsWith("A claimed row"));
  assert.equal(claimed.seat, "CLAUDE");
  assert.equal(claimed.date, "2026-10-27");
});

test("a row is dated by the day it was finished, not the day it was last touched", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const row = body.recentChanges.find((r) => r.title.startsWith("Finished last week"));
  assert.equal(row.date, "2026-10-21");
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

test("a seat is credited under one spelling whichever name it arrives with", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const row = body.recentChanges.find((r) => r.title.startsWith("Minimax filed"));
  assert.equal(row.seat, "MM");
  const mm = body.seats.find((s) => s.tag === "MM");
  // The row and the bar beside it agree.
  assert.equal(mm.recentCount, body.recentChanges.filter((r) => r.seat === "MM").length);
});

test("the seats are ranked by their count", async () => {
  const { body } = await callPanel({ env: FULL_ENV });
  const counts = body.seats.map((s) => s.recentCount);
  const sorted = [...counts].sort((a, b) => b - a);
  assert.deepEqual(counts, sorted, "the seats must come back in count order");
  assert.equal(body.seats[0].tag, "MM");
});

test("the board is asked for the window the panel says", async () => {
  const calls = [];
  await callPanel({ env: FULL_ENV, fetchStub: stubFetch({ calls }) });
  const query = calls.find((c) => c.target.includes("/graphql"));
  assert.ok(query, "the board must be asked");
  const body = JSON.parse(query.options.body);
  assert.match(body.query, /completedAt/, "the window must be a completion window");
  const since = new Date(body.variables.since).getTime();
  const days = (Date.now() - since) / 86400000;
  assert.ok(days > 13.9 && days < 14.1, `the window must be fourteen days, got ${days}`);
});

test("the counts cover the whole window, not only the rows on screen", async () => {
  // Twenty items for one seat inside the window,  and the panel shows twelve.
  const nodes = [];
  for (let i = 0; i < 20; i += 1) {
    nodes.push({
      id: String(i),
      title: `Row number ${i}`,
      updatedAt: "2026-10-28T12:00:00.000Z",
      completedAt: "2026-10-28T12:00:00.000Z",
      createdAt: "2026-10-20T12:00:00.000Z",
      state: { name: "Done", type: "completed" },
      labels: { nodes: [{ name: "seat:CODEX" }] },
    });
  }
  const { body } = await callPanel({
    env: FULL_ENV,
    fetchStub: stubFetch({ issues: { data: { issues: { nodes } } } }),
  });
  assert.equal(body.recentChanges.length, 12);
  const codex = body.seats.find((s) => s.tag === "CODEX");
  assert.equal(codex.recentCount, 20);
  assert.equal(body.seats[0].tag, "CODEX");
});

test("the corpus may answer with an event stream instead of JSON", async () => {
  const { status, body } = await callPanel({ env: FULL_ENV, fetchStub: stubFetch({ sse: true }) });
  assert.equal(status, 200);
  assert.equal(body.corpus.points, 65825);
});

test("two readers arriving on a cold cache share one trip to the upstreams", async () => {
  const modulePath = path.join(root, "start/api/rag-snapshot.js");
  delete require.cache[require.resolve(modulePath)];
  const savedFetch = globalThis.fetch;
  const calls = [];
  // The environment is set before the module is loaded:  it reads the address
  // of the corpus once,  at load time.
  for (const [key, value] of Object.entries(FULL_ENV)) process.env[key] = value;
  const handler = require(modulePath);
  const makeRes = () => {
    const headers = {};
    const state = { headers, status: 0, body: null };
    state.res = {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      status(code) {
        state.status = code;
        return this;
      },
      json(payload) {
        state.body = payload;
        return this;
      },
    };
    return state;
  };
  try {
    globalThis.fetch = stubFetch({ calls });
    const a = makeRes();
    const b = makeRes();
    await Promise.all([
      handler({ headers: { origin: "https://start.jays.services" } }, a.res),
      handler({ headers: { origin: "https://start.jays.services" } }, b.res),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const corpusCalls = calls.filter((c) => c.target.includes("/mcp")).length;
    const boardCalls = calls.filter((c) => c.target.includes("/graphql")).length;
    assert.equal(corpusCalls, 1, "the corpus must be asked once");
    assert.equal(boardCalls, 1, "the board must be asked once");
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of Object.keys(FULL_ENV)) delete process.env[key];
  }
});

test("an upstream that is gone answers 502, not an empty panel", async () => {
  const { status, body } = await callPanel({
    env: FULL_ENV,
    fetchStub: stubFetch({ fail: "/mcp" }),
  });
  assert.equal(status, 502);
  assert.ok(body.error, "the answer must say what went wrong");
  assert.ok(!body.recentChanges, "a broken upstream must not read as a board with no work on it");
});

test("a missing credential is reported without naming it", async () => {
  const { status, body } = await callPanel({
    env: { ...FULL_ENV, CF_ACCESS_CLIENT_ID: undefined },
  });
  assert.equal(status, 502);
  assert.ok(body.detail, "the answer must say what kind of failure it was");
  assert.ok(
    !String(body.detail).includes("CF_ACCESS_CLIENT_ID"),
    `the body must not name the credential: ${body.detail}`,
  );
});

test("a refused credential is reported as a masked preview, never as the key", async () => {
  const { status, body } = await callPanel({
    env: FULL_ENV,
    fetchStub: async (url, options = {}) => {
      if (String(url).includes("/mcp")) return { ok: false, status: 401, text: async () => "", json: async () => ({}) };
      throw new Error("unexpected fetch: " + url);
    },
  });
  assert.equal(status, 502);
  assert.match(body.detail, /credential was refused/);
  assert.ok(body.detail.includes("recall-t...efgh"), `the preview must be masked: ${body.detail}`);
  assert.ok(!JSON.stringify(body).includes("recall-token-abcdefgh"), "the key must never be in the body");
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
