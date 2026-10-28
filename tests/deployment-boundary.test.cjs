const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'start/vercel.json')));

// public/logos is an explicit allowlist, not a wildcard: this guard exists to
// catch a private document or an unreviewed asset reaching the deployed site, so
// a new file must be added here deliberately.  Two sets, both synced by
// scripts/sync-logos.mjs from the app that owns the art:
//   provider marks — the quota panel, and the Fleet RAG card's seat chips /
//                    Top Seats bars.  Copied from CodeCaps' ProviderMarks.
//   app icons      — the Fleet RAG card's Components panel, beside each app
//                    name.  Copied from Personal-Site/static/app-icons/.
// The four files no source owns are the exceptions, listed with their reason.
// See docs/provider-marks.md.
const PROVIDER_MARKS = [
  'claude-color.png', 'openai-color.png', 'grok-color.png', 'grok-bot-color.png',
  'gemini-color.png', 'cursor-color.png', 'muse-assist-color.png',
  'muse-code-color.png', 'minimax.png',
];
// CodeCaps does not poll DeepSeek or Kimi and ships no artwork, and Monet and
// Renoir are seats with no provider, so nothing else owns these marks.
const UNSOURCED_MARKS = ['deepseek.svg', 'kimi.svg', 'monet.svg', 'renoir.svg'];
const SEAT_MARKS = [...PROVIDER_MARKS, ...UNSOURCED_MARKS];
const APP_ICONS = [
  'app-st.png', 'app-ct.png', 'app-um.png', 'app-bf.png', 'app-dd.png',
  'app-cl.png', 'app-ar.png', 'app-ps.png', 'app-afc.png', 'app-fl.png',
];
const LOGO_FILES = [...SEAT_MARKS, ...APP_ICONS].map((f) => `logos/${f}`).sort();

test('static output contains only intended web assets and no repository data', () => {
  assert.equal(config.outputDirectory, 'public');
  const files = fs.readdirSync(path.join(root, 'start/public'), { recursive: true }).sort();
  assert.deepEqual(files, ['admin', 'admin/index.html', 'admin/muse-assist.png', 'index.html', 'logos', ...LOGO_FILES, 'robots.txt']);
  // Every declared logo must actually exist, so deleting one fails here rather
  // than shipping a 404 the page silently falls back from.
  for (const rel of LOGO_FILES) {
    assert.ok(fs.existsSync(path.join(root, 'start/public', rel)), `${rel} is declared but missing`);
  }
  assert.match(fs.readFileSync(path.join(root, 'start/public/index.html'), 'utf8'), /\/api\/quota/);
  assert.ok(config.functions['api/quota.js']);
  assert.ok(config.functions['api/admin.js']);
  assert.equal(config.functions['api/rag-snapshot.js'].includeFiles, 'site-snapshot.json');
});

test('every logo the page or the snapshot names is a file that ships', () => {
  // The allowlist above says what may be served; this says what is actually
  // asked for.  A mark or icon that is renamed in the table without being
  // re-synced is a 404 the page silently degrades from — an app icon falls
  // back to a monogram tile, a provider mark falls back to no mark — so the
  // two lists have to agree in both directions.
  const referenced = new Set();
  for (const rel of ['start/public/index.html', 'scripts/build-rag-snapshot.mjs']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const [, name] of text.matchAll(/["']([A-Za-z0-9._-]+\.(?:png|svg))["']/g)) {
      referenced.add(name);
    }
  }
  assert.ok(referenced.size >= 20, `expected the page to name its marks, found ${referenced.size}`);
  for (const name of referenced) {
    assert.ok(fs.existsSync(path.join(root, 'start/public/logos', name)), `${name} is named but not served`);
    assert.ok(LOGO_FILES.includes(`logos/${name}`), `${name} is named but not on the deployment allowlist`);
  }
  for (const rel of LOGO_FILES) {
    const name = rel.replace('logos/', '');
    assert.ok(referenced.has(name), `${name} ships but nothing references it`);
  }
});

test('every component acronym the roster uses still has a palette colour', () => {
  // colorFor() paints the monogram tile when a component has no icon.  A
  // renamed acronym that misses this map does not fail — it silently falls back
  // to grey, which is the exact thing renaming AFL to AFC nearly did.
  const roster = fs.readFileSync(path.join(root, 'scripts/build-rag-snapshot.mjs'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'start/public/index.html'), 'utf8');
  const palette = page.slice(page.indexOf('const palette = {'), page.indexOf('const palette = {') + 800);
  const keys = new Set([...palette.matchAll(/([A-Z]{2,4}):\s*"#[0-9A-Fa-f]{6}"/g)].map((m) => m[1]));
  const acronyms = [...roster.slice(0, roster.indexOf('const SEATS')).matchAll(/acronym:\s*"([A-Z]{2,4})"/g)].map((m) => m[1]);
  assert.ok(acronyms.length >= 10, `expected to read the roster, found ${acronyms.length}`);
  for (const acr of acronyms) {
    assert.ok(keys.has(acr), `${acr} is a component but has no palette colour`);
  }
});

test('deployment input allowlist rejects private documents and future unknown files', () => {
  // Git and .vercelignore use ignore-style patterns; test with tracked-file checks disabled.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-deploy-boundary-'));
  try {
    execFileSync('git', ['init', '-q', temp]);
    fs.copyFileSync(path.join(root, 'start/.vercelignore'), path.join(temp, '.gitignore'));
    const allowed = [
      'public/index.html', 'public/robots.txt', 'public/admin/index.html', 'public/admin/muse-assist.png',
      ...LOGO_FILES.map((f) => `public/${f}`),
      'api/quota.js', 'api/rag-snapshot.js', 'api/admin.js', 'api/_admin/worker.mjs', 'site-snapshot.json', 'vercel.json', 'vercel-ignore.sh',
    ];
    const denied = ['site/index.html', 'site/src/app.ts', 'docs/rollouts/2026-01-01-note.md', 'static/app-icons/ar.png', 'scripts/infisical-fetch.mjs', 'scripts/build-rag-snapshot.mjs', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'api/new-private-helper.js', 'api/_admin/notes.md', '.env', 'new-inventory.json'];
    for (const name of [...allowed, ...denied]) {
      fs.mkdirSync(path.dirname(path.join(temp, name)), { recursive: true });
      fs.writeFileSync(path.join(temp, name), 'fixture');
    }
    const ignored = execFileSync('git', ['-C', temp, 'check-ignore', '--no-index', ...allowed, ...denied], { encoding: 'utf8' }).trim().split('\n').sort();
    assert.deepEqual(ignored, denied.sort());
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('snapshot API can read explicit bundled data without serving it statically', async () => {
  const handler = require('../start/api/rag-snapshot.js');
  const previous = process.cwd();
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, send(s) { this.body = s; }, json(s) { this.body = JSON.stringify(s); } };
  try {
    process.chdir(root);
    await handler({}, res);
  } finally { process.chdir(previous); }
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "private, no-store");
  assert.deepEqual(JSON.parse(res.body), JSON.parse(fs.readFileSync(path.join(root, 'start/site-snapshot.json'))));
  assert.equal(fs.existsSync(path.join(root, 'start/public/site-snapshot.json')), false);
});

test('the deployed tree carries no documentation, inventory or source outside its allowlist', () => {
  // This repository is public and holds the owner's main site, its documentation
  // and its scripts.  Only the `start/` subtree is deployed, and inside it only
  // the inputs the deployment allowlist names.  Nothing else — a Markdown file, a
  // credential, a source file from another part of the repository — may sit
  // inside the deployed tree, because the site is served straight from it.
  const deployed = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, 'start', rel), { withFileTypes: true })) {
      const child = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else deployed.push(child);
    }
  };
  walk('.');
  for (const rel of deployed) {
    assert.doesNotMatch(rel, /\.md$/i, `${rel} is a document and must not sit in the deployed tree`);
    assert.doesNotMatch(rel, /^\.env/i, `${rel} looks like a credential file and must not sit in the deployed tree`);
  }
  const outside = ['site', 'docs', 'static', 'scripts', 'tests'];
  for (const dir of outside) {
    assert.ok(!deployed.some((rel) => rel.startsWith(`${dir}/`)), `${dir}/ must not be inside the deployed tree`);
  }
});
