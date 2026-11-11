const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// The operator start page is the fleet's public face:  the quota panel, the RAG
// card and the chat links.  These checks used to live in the Fleet-OPS
// repository's identity-vocabulary test, alongside that repository's own
// agent-visible files; they moved here with the page they read, because this
// repository is where the page now lives.
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const page = read('start/public/index.html');

test('the operator start page names the live Datadog site', () => {
  assert.match(page, /sub: "us5\.datadoghq\.com"/);
  assert.match(page, /url: "https:\/\/us5\.datadoghq\.com\/"/);
  assert.doesNotMatch(page, /slack\.com\/app_redirect/);
});

test('the operator start page links chat to the fleet Zulip realm', () => {
  assert.match(page, /name: "#Work-In-Progress"/);
  assert.doesNotMatch(page, /#agent-sync(?![\w-])/);
  assert.match(page, /url: "https:\/\/fleetlink\.online\/zulip\/zulip-fleet-guide\.md"/);
  assert.doesNotMatch(page, /slack\.com\/app_redirect/);
  assert.doesNotMatch(page, /\[REDACTED\]\.zulipchat\.com/);
});
