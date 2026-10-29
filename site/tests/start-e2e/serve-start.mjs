#!/usr/bin/env node
// A dependency-free static server for the start site, used by the start site's
// Playwright specs.  The site's own tree has no build step — it is a plain
// static directory with a few serverless functions beside it — so the specs
// need a static file server and nothing more.  The /api/* endpoints the page
// calls are route-mocked in the specs, so they never reach this server.
//
// Usage: node site/tests/start-e2e/serve-start.mjs [port]
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../../start/public", import.meta.url)));
const PORT = Number(process.argv[2] || process.env.START_SITE_PORT || 3102);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  // normalize() collapses any ../ segments before the join, so a request can
  // never climb out of the served directory.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end("forbidden");
    return;
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, "index.html");
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`start site served from ${ROOT} on http://127.0.0.1:${PORT}`);
});
